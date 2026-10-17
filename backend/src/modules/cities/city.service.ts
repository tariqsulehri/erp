import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { CreateCityInput, ListCitiesQuery, UpdateCityInput } from './city.schema.js';

function businessError(message: string, statusCode = 400) {
  const error = new Error(message);
  Object.assign(error, { statusCode });
  return error;
}

function mapCity(row: {
  id: string;
  stateId: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  state?: { name: string } | null;
}) {
  return {
    id: row.id,
    state_id: row.stateId,
    state_name: row.state?.name ?? null,
    name: row.name,
    is_active: row.isActive,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export class CityService {
  constructor(private readonly companyId: string) {}

  async list(query: ListCitiesQuery) {
    const where: Prisma.CityWhereInput = { companyId: this.companyId };

    if (query.status === 'Active') where.isActive = true;
    if (query.status === 'Inactive') where.isActive = false;
    if (query.state_id) where.stateId = query.state_id;
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const [total, rows] = await Promise.all([
      prisma.city.count({ where }),
      prisma.city.findMany({
        where,
        include: { state: { select: { name: true } } },
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    const cityIds = rows.map(row => row.id);
    const areaCounts = cityIds.length
      ? await prisma.area.groupBy({
          by: ['cityId'],
          where: { companyId: this.companyId, cityId: { in: cityIds }, isActive: true },
          _count: { _all: true },
        })
      : [];
    const countByCity = new Map(areaCounts.map(row => [row.cityId, row._count._all]));

    return {
      data: rows.map(row => ({
        ...mapCity(row),
        active_area_count: countByCity.get(row.id) ?? 0,
      })),
      pagination: { total, page: query.page, limit: query.limit, pages: Math.ceil(total / query.limit) },
    };
  }

  async getById(id: string) {
    const city = await prisma.city.findFirst({
      where: { id, companyId: this.companyId },
      include: { state: { select: { name: true } } },
    });
    return city ? mapCity(city) : null;
  }

  async create(input: CreateCityInput) {
    await this.assertStateExists(input.state_id);
    await this.assertUniqueName(input.state_id, input.name);

    const city = await prisma.city.create({
      data: {
        companyId: this.companyId,
        stateId: input.state_id,
        name: input.name,
        isActive: input.is_active,
      },
      include: { state: { select: { name: true } } },
    });

    return mapCity(city);
  }

  async update(input: UpdateCityInput) {
    const existing = await this.requireCity(input.id);
    const stateId = input.state_id ?? existing.stateId;
    const name = input.name ?? existing.name;

    if (input.state_id && input.state_id !== existing.stateId) {
      await this.assertStateExists(input.state_id);
    }

    if (name !== existing.name || stateId !== existing.stateId) {
      await this.assertUniqueName(stateId, name, input.id);
    }

    if (input.is_active === false) {
      await this.assertCityCanBeInactive(input.id);
    }

    const city = await prisma.city.update({
      where: { id: input.id },
      data: {
        ...(input.state_id !== undefined && { stateId: input.state_id }),
        ...(input.name !== undefined && { name: input.name }),
        ...(input.is_active !== undefined && { isActive: input.is_active }),
      },
      include: { state: { select: { name: true } } },
    });

    return mapCity(city);
  }

  private async requireCity(id: string) {
    const city = await prisma.city.findFirst({ where: { id, companyId: this.companyId } });
    if (!city) throw businessError('City not found.', 404);
    return city;
  }

  private async assertStateExists(stateId: string) {
    const state = await prisma.state.findFirst({
      where: { id: stateId, companyId: this.companyId },
      select: { id: true },
    });
    if (!state) throw businessError('Selected State does not exist.');
  }

  private async assertUniqueName(stateId: string, name: string, ignoreId?: string) {
    const existing = await prisma.city.findFirst({
      where: { companyId: this.companyId, stateId, name, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
      select: { id: true },
    });
    if (existing) throw businessError('City Name is already used in this State.');
  }

  private async assertCityCanBeInactive(cityId: string) {
    const activeArea = await prisma.area.findFirst({
      where: { companyId: this.companyId, cityId, isActive: true },
      select: { id: true },
    });
    if (activeArea) throw businessError('City has active Areas and cannot be made Inactive.');
  }
}
