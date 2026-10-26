import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { CreateStateInput, ListStatesQuery, UpdateStateInput } from './state.schema.js';

function businessError(message: string, statusCode = 400) {
  const error = new Error(message);
  Object.assign(error, { statusCode });
  return error;
}

function mapState(row: {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    is_active: row.isActive,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export class StateService {
  constructor(private readonly companyId: string) {}

  async list(query: ListStatesQuery) {
    const where: Prisma.StateWhereInput = { companyId: this.companyId };

    if (query.status === 'Active') where.isActive = true;
    if (query.status === 'Inactive') where.isActive = false;
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const [total, rows] = await Promise.all([
      prisma.state.count({ where }),
      prisma.state.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    const stateIds = rows.map(row => row.id);
    const cityCounts = stateIds.length
      ? await prisma.city.groupBy({
          by: ['stateId'],
          where: { companyId: this.companyId, stateId: { in: stateIds }, isActive: true },
          _count: { _all: true },
        })
      : [];
    const countByState = new Map(cityCounts.map(row => [row.stateId, row._count._all]));

    return {
      data: rows.map(row => ({
        ...mapState(row),
        active_city_count: countByState.get(row.id) ?? 0,
      })),
      pagination: { total, page: query.page, limit: query.limit, pages: Math.ceil(total / query.limit) },
    };
  }

  async getById(id: string) {
    const state = await prisma.state.findFirst({ where: { id, companyId: this.companyId } });
    return state ? mapState(state) : null;
  }

  async create(input: CreateStateInput) {
    await this.assertUniqueName(input.name);

    const state = await prisma.state.create({
      data: {
        companyId: this.companyId,
        name: input.name,
        isActive: input.is_active,
      },
    });

    return mapState(state);
  }

  async update(input: UpdateStateInput) {
    const existing = await this.requireState(input.id);
    if (input.name && input.name !== existing.name) {
      await this.assertUniqueName(input.name, input.id);
    }
    if (input.is_active === false) {
      await this.assertStateCanBeInactive(input.id);
    }

    const state = await prisma.state.update({
      where: { id: input.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.is_active !== undefined && { isActive: input.is_active }),
      },
    });

    return mapState(state);
  }

  private async requireState(id: string) {
    const state = await prisma.state.findFirst({ where: { id, companyId: this.companyId } });
    if (!state) throw businessError('State not found.', 404);
    return state;
  }

  private async assertUniqueName(name: string, ignoreId?: string) {
    const existing = await prisma.state.findFirst({
      where: { companyId: this.companyId, name, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
      select: { id: true },
    });
    if (existing) throw businessError('State Name is already used.');
  }

  private async assertStateCanBeInactive(stateId: string) {
    const activeCity = await prisma.city.findFirst({
      where: { companyId: this.companyId, stateId, isActive: true },
      select: { id: true },
    });
    if (activeCity) throw businessError('State has active Cities and cannot be made Inactive.');
  }
}
