import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { CreateBranchInput, ListBranchesQuery, UpdateBranchInput } from './branch.schema.js';

function businessError(message: string, statusCode = 400) {
  const error = new Error(message);
  Object.assign(error, { statusCode });
  return error;
}

function textOrNull(value?: string | null) {
  const clean = value?.trim();
  return clean ? clean : null;
}

function mapBranch(row: {
  id: string;
  code: string;
  name: string;
  description: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  managerName: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    address: row.address,
    city: row.city,
    phone: row.phone,
    email: row.email,
    manager_name: row.managerName,
    is_default: row.isDefault,
    is_active: row.isActive,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export class BranchService {
  constructor(private readonly companyId: string) {}

  async list(query: ListBranchesQuery) {
    const where: Prisma.BranchWhereInput = { companyId: this.companyId };

    if (query.status === 'Active') where.isActive = true;
    if (query.status === 'Inactive') where.isActive = false;
    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
        { city: { contains: query.search, mode: 'insensitive' } },
        { managerName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await Promise.all([
      prisma.branch.count({ where }),
      prisma.branch.findMany({
        where,
        orderBy: [{ isDefault: 'desc' }, { code: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    const branchIds = rows.map(row => row.id);
    const warehouseCounts = branchIds.length
      ? await prisma.warehouse.groupBy({
          by: ['branchId'],
          where: { companyId: this.companyId, branchId: { in: branchIds }, isActive: true },
          _count: { _all: true },
        })
      : [];
    const countByBranch = new Map(warehouseCounts.map(row => [row.branchId, row._count._all]));

    return {
      data: rows.map(row => ({ ...mapBranch(row), active_warehouse_count: countByBranch.get(row.id) ?? 0 })),
      pagination: { total, page: query.page, limit: query.limit, pages: Math.ceil(total / query.limit) },
    };
  }

  async getById(id: string) {
    const branch = await prisma.branch.findFirst({ where: { id, companyId: this.companyId } });
    return branch ? mapBranch(branch) : null;
  }

  async create(input: CreateBranchInput) {
    await this.assertUniqueCode(input.code);

    return prisma.$transaction(async transaction => {
      const existingCount = await transaction.branch.count({ where: { companyId: this.companyId } });
      const shouldBeDefault = input.is_default || existingCount === 0;

      if (shouldBeDefault) {
        await transaction.branch.updateMany({ where: { companyId: this.companyId }, data: { isDefault: false } });
      }

      const branch = await transaction.branch.create({
        data: {
          companyId: this.companyId,
          code: input.code,
          name: input.name,
          description: textOrNull(input.description),
          address: textOrNull(input.address),
          city: textOrNull(input.city),
          phone: textOrNull(input.phone),
          email: textOrNull(input.email),
          managerName: textOrNull(input.manager_name),
          isDefault: shouldBeDefault,
          isActive: input.is_active,
        },
      });

      return mapBranch(branch);
    });
  }

  async update(input: UpdateBranchInput) {
    const existing = await this.requireBranch(input.id);
    if (input.code && input.code !== existing.code) {
      await this.assertUniqueCode(input.code, input.id);
    }
    if (input.is_active === false) {
      await this.assertBranchCanBeInactive(input.id, existing.isDefault);
    }

    return prisma.$transaction(async transaction => {
      if (input.is_default) {
        await transaction.branch.updateMany({
          where: { companyId: this.companyId, id: { not: input.id } },
          data: { isDefault: false },
        });
      }

      const branch = await transaction.branch.update({
        where: { id: input.id },
        data: {
          ...(input.code !== undefined && { code: input.code }),
          ...(input.name !== undefined && { name: input.name }),
          ...(input.description !== undefined && { description: textOrNull(input.description) }),
          ...(input.address !== undefined && { address: textOrNull(input.address) }),
          ...(input.city !== undefined && { city: textOrNull(input.city) }),
          ...(input.phone !== undefined && { phone: textOrNull(input.phone) }),
          ...(input.email !== undefined && { email: textOrNull(input.email) }),
          ...(input.manager_name !== undefined && { managerName: textOrNull(input.manager_name) }),
          ...(input.is_default !== undefined && { isDefault: input.is_default }),
          ...(input.is_active !== undefined && { isActive: input.is_active }),
        },
      });

      return mapBranch(branch);
    });
  }

  private async requireBranch(id: string) {
    const branch = await prisma.branch.findFirst({ where: { id, companyId: this.companyId } });
    if (!branch) throw businessError('Branch not found.', 404);
    return branch;
  }

  private async assertUniqueCode(code: string, ignoreId?: string) {
    const existing = await prisma.branch.findFirst({
      where: { companyId: this.companyId, code, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
      select: { id: true },
    });
    if (existing) throw businessError('Branch Code is already used.');
  }

  private async assertBranchCanBeInactive(branchId: string, isDefault: boolean) {
    if (isDefault) throw businessError('Default Branch cannot be made Inactive. Select another default branch first.');

    const activeWarehouse = await prisma.warehouse.findFirst({
      where: { companyId: this.companyId, branchId, isActive: true },
      select: { id: true },
    });
    if (activeWarehouse) throw businessError('Branch has active Warehouses and cannot be made Inactive.');
  }
}
