import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { CreateAreaInput, ListAreasQuery, UpdateAreaInput } from './area.schema.js';

function businessError(message: string, statusCode = 400) {
  const error = new Error(message);
  Object.assign(error, { statusCode });
  return error;
}

function mapArea(row: {
  id: string;
  cityId: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  city?: {
    name: string;
    state?: { id: string; name: string } | null;
  } | null;
}) {
  return {
    id: row.id,
    city_id: row.cityId,
    city_name: row.city?.name ?? null,
    state_id: row.city?.state?.id ?? null,
    state_name: row.city?.state?.name ?? null,
    name: row.name,
    is_active: row.isActive,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export class AreaService {
  constructor(private readonly companyId: string) {}

  async list(query: ListAreasQuery) {
    const where: Prisma.AreaWhereInput = { companyId: this.companyId };

    if (query.status === 'Active') where.isActive = true;
    if (query.status === 'Inactive') where.isActive = false;
    if (query.city_id) where.cityId = query.city_id;
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const [total, rows] = await Promise.all([
      prisma.area.count({ where }),
      prisma.area.findMany({
        where,
        include: {
          city: {
            include: {
              state: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return {
      data: rows.map(row => mapArea(row)),
      pagination: { total, page: query.page, limit: query.limit, pages: Math.ceil(total / query.limit) },
    };
  }

  async getById(id: string) {
    const area = await prisma.area.findFirst({
      where: { id, companyId: this.companyId },
      include: {
        city: {
          include: {
            state: { select: { id: true, name: true } },
          },
        },
      },
    });
    return area ? mapArea(area) : null;
  }

  async create(input: CreateAreaInput) {
    await this.assertCityExists(input.city_id);
    await this.assertUniqueName(input.city_id, input.name);

    const area = await prisma.area.create({
      data: {
        companyId: this.companyId,
        cityId: input.city_id,
        name: input.name,
        isActive: input.is_active,
      },
      include: {
        city: {
          include: {
            state: { select: { id: true, name: true } },
          },
        },
      },
    });

    return mapArea(area);
  }

  async update(input: UpdateAreaInput) {
    const existing = await this.requireArea(input.id);
    const cityId = input.city_id ?? existing.cityId;
    const name = input.name ?? existing.name;

    if (input.city_id && input.city_id !== existing.cityId) {
      await this.assertCityExists(input.city_id);
    }

    if (name !== existing.name || cityId !== existing.cityId) {
      await this.assertUniqueName(cityId, name, input.id);
    }

    const area = await prisma.area.update({
      where: { id: input.id },
      data: {
        ...(input.city_id !== undefined && { cityId: input.city_id }),
        ...(input.name !== undefined && { name: input.name }),
        ...(input.is_active !== undefined && { isActive: input.is_active }),
      },
      include: {
        city: {
          include: {
            state: { select: { id: true, name: true } },
          },
        },
      },
    });

    return mapArea(area);
  }

  private async requireArea(id: string) {
    const area = await prisma.area.findFirst({ where: { id, companyId: this.companyId } });
    if (!area) throw businessError('Area not found.', 404);
    return area;
  }

  private async assertCityExists(cityId: string) {
    const city = await prisma.city.findFirst({
      where: { id: cityId, companyId: this.companyId },
      select: { id: true },
    });
    if (!city) throw businessError('Selected City does not exist.');
  }

  private async assertUniqueName(cityId: string, name: string, ignoreId?: string) {
    const existing = await prisma.area.findFirst({
      where: { companyId: this.companyId, cityId, name, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
      select: { id: true },
    });
    if (existing) throw businessError('Area Name is already used in this City.');
  }
}
