import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type {
  CreateWarehouseInput,
  CreateWarehouseLocationInput,
  ListWarehouseStockQuery,
  ListWarehousesQuery,
  UpdateWarehouseInput,
  UpdateWarehouseLocationInput,
} from './warehouse.schema.js';

function businessError(message: string, statusCode = 400) {
  const error = new Error(message);
  Object.assign(error, { statusCode });
  return error;
}

function textOrNull(value?: string | null) {
  const clean = value?.trim();
  return clean ? clean : null;
}

function decimalText(value: unknown) {
  if (value == null) return '0';
  if (typeof value === 'object' && 'toString' in value) return value.toString();
  return String(value);
}

function mapWarehouse(row: {
  id: string;
  code: string;
  name: string;
  branchId?: string | null;
  description: string | null;
  address: string | null;
  isDefault: boolean;
  useLocations: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    branch_id: row.branchId ?? null,
    description: row.description,
    address: row.address,
    is_default: row.isDefault,
    use_locations: row.useLocations,
    is_active: row.isActive,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

function mapLocation(row: {
  id: string;
  warehouseId: string;
  code: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    warehouse_id: row.warehouseId,
    code: row.code,
    name: row.name,
    description: row.description,
    is_default: row.isDefault,
    is_active: row.isActive,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export class WarehouseService {
  constructor(private readonly companyId: string) {}

  async list(query: ListWarehousesQuery) {
    const where: Prisma.WarehouseWhereInput = { companyId: this.companyId };

    if (query.status === 'Active') where.isActive = true;
    if (query.status === 'Inactive') where.isActive = false;
    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
        { address: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await Promise.all([
      prisma.warehouse.count({ where }),
      prisma.warehouse.findMany({
        where,
        include: { branch: { select: { id: true, code: true, name: true } } },
        orderBy: [{ isDefault: 'desc' }, { code: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    const warehouseIds = rows.map(row => row.id);
    const stockRows = warehouseIds.length
      ? await prisma.stockBalance.groupBy({
          by: ['warehouseId'],
          where: { companyId: this.companyId, warehouseId: { in: warehouseIds }, isActive: true },
          _count: { _all: true },
          _sum: { stockOnHand: true, availableStock: true, totalStockValue: true },
        })
      : [];
    const stockByWarehouse = new Map(stockRows.map(row => [row.warehouseId, row]));

    return {
      data: rows.map(row => {
        const stock = stockByWarehouse.get(row.id);
        return {
          ...mapWarehouse(row),
          branch: row.branch ? { id: row.branch.id, code: row.branch.code, name: row.branch.name } : null,
          stock_item_count: stock?._count._all ?? 0,
          stock_on_hand: decimalText(stock?._sum.stockOnHand),
          available_stock: decimalText(stock?._sum.availableStock),
          total_stock_value: decimalText(stock?._sum.totalStockValue),
        };
      }),
      pagination: { total, page: query.page, limit: query.limit, pages: Math.ceil(total / query.limit) },
    };
  }

  async getById(id: string) {
    const warehouse = await prisma.warehouse.findFirst({
      where: { id, companyId: this.companyId },
      include: { locations: { orderBy: [{ isDefault: 'desc' }, { code: 'asc' }] } },
    });
    if (!warehouse) return null;

    return {
      ...mapWarehouse(warehouse),
      locations: warehouse.locations.map(mapLocation),
    };
  }

  async create(input: CreateWarehouseInput) {
    await this.assertUniqueWarehouseCode(input.code);
    if (input.branch_id) await this.assertActiveBranch(input.branch_id);

    return prisma.$transaction(async transaction => {
      const existingCount = await transaction.warehouse.count({ where: { companyId: this.companyId } });
      const shouldBeDefault = input.is_default || existingCount === 0;

      if (shouldBeDefault) {
        await transaction.warehouse.updateMany({
          where: { companyId: this.companyId },
          data: { isDefault: false },
        });
      }

      const warehouse = await transaction.warehouse.create({
        data: {
          companyId: this.companyId,
          branchId: textOrNull(input.branch_id),
          code: input.code,
          name: input.name,
          description: textOrNull(input.description),
          address: textOrNull(input.address),
          isDefault: shouldBeDefault,
          useLocations: input.use_locations,
          isActive: input.is_active,
        },
      });

      return mapWarehouse(warehouse);
    });
  }

  async update(input: UpdateWarehouseInput) {
    const existing = await this.requireWarehouse(input.id);
    if (input.code && input.code !== existing.code) {
      await this.assertUniqueWarehouseCode(input.code, input.id);
    }
    if (input.branch_id) await this.assertActiveBranch(input.branch_id);
    if (input.is_active === false) {
      await this.assertWarehouseCanBeInactive(input.id, existing.isDefault);
    }
    if (input.use_locations !== undefined && input.use_locations !== existing.useLocations) {
      await this.assertWarehouseLocationModeCanChange(input.id, input.use_locations);
    }

    return prisma.$transaction(async transaction => {
      if (input.is_default) {
        await transaction.warehouse.updateMany({
          where: { companyId: this.companyId, id: { not: input.id } },
          data: { isDefault: false },
        });
      }

      const warehouse = await transaction.warehouse.update({
        where: { id: input.id },
        data: {
          ...(input.code !== undefined && { code: input.code }),
          ...(input.name !== undefined && { name: input.name }),
          ...(input.branch_id !== undefined && { branchId: textOrNull(input.branch_id) }),
          ...(input.description !== undefined && { description: textOrNull(input.description) }),
          ...(input.address !== undefined && { address: textOrNull(input.address) }),
          ...(input.is_default !== undefined && { isDefault: input.is_default }),
          ...(input.use_locations !== undefined && { useLocations: input.use_locations }),
          ...(input.is_active !== undefined && { isActive: input.is_active }),
        },
      });

      return mapWarehouse(warehouse);
    });
  }

  async listLocations(warehouseId: string) {
    await this.requireWarehouse(warehouseId);
    const rows = await prisma.warehouseLocation.findMany({
      where: { companyId: this.companyId, warehouseId },
      orderBy: [{ isDefault: 'desc' }, { code: 'asc' }],
    });
    return rows.map(mapLocation);
  }

  async createLocation(warehouseId: string, input: CreateWarehouseLocationInput) {
    await this.requireWarehouse(warehouseId);
    await this.assertUniqueLocationCode(warehouseId, input.code);

    return prisma.$transaction(async transaction => {
      const existingCount = await transaction.warehouseLocation.count({
        where: { companyId: this.companyId, warehouseId },
      });
      const shouldBeDefault = input.is_default || existingCount === 0;

      if (shouldBeDefault) {
        await transaction.warehouseLocation.updateMany({
          where: { companyId: this.companyId, warehouseId },
          data: { isDefault: false },
        });
      }

      const location = await transaction.warehouseLocation.create({
        data: {
          companyId: this.companyId,
          warehouseId,
          code: input.code,
          name: input.name,
          description: textOrNull(input.description),
          isDefault: shouldBeDefault,
          isActive: input.is_active,
        },
      });

      return mapLocation(location);
    });
  }

  async updateLocation(input: UpdateWarehouseLocationInput) {
    const existing = await this.requireLocation(input.id);
    if (input.code && input.code !== existing.code) {
      await this.assertUniqueLocationCode(existing.warehouseId, input.code, input.id);
    }
    if (input.is_active === false) {
      await this.assertLocationCanBeInactive(input.id, existing.isDefault);
    }

    return prisma.$transaction(async transaction => {
      if (input.is_default) {
        await transaction.warehouseLocation.updateMany({
          where: { companyId: this.companyId, warehouseId: existing.warehouseId, id: { not: input.id } },
          data: { isDefault: false },
        });
      }

      const location = await transaction.warehouseLocation.update({
        where: { id: input.id },
        data: {
          ...(input.code !== undefined && { code: input.code }),
          ...(input.name !== undefined && { name: input.name }),
          ...(input.description !== undefined && { description: textOrNull(input.description) }),
          ...(input.is_default !== undefined && { isDefault: input.is_default }),
          ...(input.is_active !== undefined && { isActive: input.is_active }),
        },
      });

      return mapLocation(location);
    });
  }

  async stockSummary(warehouseId: string, query: ListWarehouseStockQuery) {
    await this.requireWarehouse(warehouseId);
    const params: unknown[] = [this.companyId, warehouseId];
    const where = [
      'sb.company_id = CAST($1 AS uuid)',
      'sb.warehouse_id = CAST($2 AS uuid)',
      'sb.is_active = true',
    ];

    if (query.search) {
      params.push(`%${query.search}%`);
      const p = `$${params.length}`;
      where.push(`(i.item_code ILIKE ${p} OR COALESCE(i.sku, '') ILIKE ${p} OR i.item_name ILIKE ${p} OR COALESCE(wl.name, '') ILIKE ${p})`);
    }

    const whereSql = where.join(' AND ');
    const countRows = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
      `
        SELECT COUNT(*)::int AS total
        FROM inventory_stock_balances sb
        JOIN inventory_items i ON i.id = sb.item_id
        LEFT JOIN inventory_warehouse_locations wl ON wl.id = sb.location_id
        WHERE ${whereSql}
      `,
      ...params,
    );

    params.push(query.limit, (query.page - 1) * query.limit);
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
        SELECT
          sb.id,
          i.item_code,
          COALESCE(i.sku, i.item_code) AS sku,
          i.item_name,
          wl.code AS location_code,
          wl.name AS location_name,
          sb.stock_on_hand::text,
          sb.reserved_stock::text,
          sb.available_stock::text,
          sb.average_cost::text,
          sb.total_stock_value::text
        FROM inventory_stock_balances sb
        JOIN inventory_items i ON i.id = sb.item_id
        LEFT JOIN inventory_warehouse_locations wl ON wl.id = sb.location_id
        WHERE ${whereSql}
        ORDER BY i.item_code ASC, wl.code ASC NULLS FIRST
        LIMIT $${params.length - 1}
        OFFSET $${params.length}
      `,
      ...params,
    );

    const total = Number(countRows[0]?.total ?? 0);
    return {
      data: rows,
      pagination: { total, page: query.page, limit: query.limit, pages: Math.ceil(total / query.limit) },
    };
  }

  private async requireWarehouse(id: string) {
    const warehouse = await prisma.warehouse.findFirst({ where: { id, companyId: this.companyId } });
    if (!warehouse) throw businessError('Warehouse not found.', 404);
    return warehouse;
  }

  private async requireLocation(id: string) {
    const location = await prisma.warehouseLocation.findFirst({ where: { id, companyId: this.companyId } });
    if (!location) throw businessError('Warehouse Location not found.', 404);
    return location;
  }

  private async assertUniqueWarehouseCode(code: string, ignoreId?: string) {
    const existing = await prisma.warehouse.findFirst({
      where: { companyId: this.companyId, code, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
      select: { id: true },
    });
    if (existing) throw businessError('Warehouse Code is already used.');
  }

  private async assertActiveBranch(branchId: string) {
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, companyId: this.companyId, isActive: true },
      select: { id: true },
    });
    if (!branch) throw businessError('Please select an Active Branch.');
  }

  private async assertUniqueLocationCode(warehouseId: string, code: string, ignoreId?: string) {
    const existing = await prisma.warehouseLocation.findFirst({
      where: { companyId: this.companyId, warehouseId, code, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
      select: { id: true },
    });
    if (existing) throw businessError('Location Code is already used in this warehouse.');
  }

  private async assertWarehouseCanBeInactive(warehouseId: string, isDefault: boolean) {
    if (isDefault) throw businessError('Default Warehouse cannot be made Inactive. Select another default warehouse first.');

    const stock = await prisma.stockBalance.findFirst({
      where: { companyId: this.companyId, warehouseId, isActive: true, stockOnHand: { gt: 0 } },
      select: { id: true },
    });
    if (stock) throw businessError('Warehouse has stock on hand and cannot be made Inactive.');
  }

  private async assertWarehouseLocationModeCanChange(warehouseId: string, useLocations: boolean) {
    const stock = await prisma.stockBalance.findFirst({
      where: {
        companyId: this.companyId,
        warehouseId,
        isActive: true,
        stockOnHand: { gt: 0 },
        locationId: useLocations ? null : { not: null },
      },
      select: { id: true },
    });

    if (stock && useLocations) {
      throw businessError('Warehouse has stock without Location. Move or adjust stock before enabling Locations.');
    }
    if (stock) {
      throw businessError('Warehouse has stock in Locations. Move or adjust stock before disabling Locations.');
    }
  }

  private async assertLocationCanBeInactive(locationId: string, isDefault: boolean) {
    if (isDefault) throw businessError('Default Location cannot be made Inactive. Select another default location first.');

    const stock = await prisma.stockBalance.findFirst({
      where: { companyId: this.companyId, locationId, isActive: true, stockOnHand: { gt: 0 } },
      select: { id: true },
    });
    if (stock) throw businessError('Warehouse Location has stock on hand and cannot be made Inactive.');
  }
}
