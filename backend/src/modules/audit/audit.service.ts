import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { AuthUser } from '../auth/access-rules.js';
import type { CreateAuditLogInput, ListAuditLogsQuery } from './audit.schema.js';

export class AuditService {
  constructor(private readonly companyId: string, private readonly actor?: AuthUser) {}

  async list(query: ListAuditLogsQuery) {
    const where: Prisma.SystemAuditLogWhereInput = { companyId: this.companyId };

    if (query.entity_name) {
      where.entityName = { equals: query.entity_name, mode: 'insensitive' };
    }
    if (query.action) {
      where.action = { equals: query.action, mode: 'insensitive' };
    }
    if (query.user_id) {
      where.userId = query.user_id;
    }
    if (query.from_date || query.to_date) {
      where.createdAt = {};
      if (query.from_date) {
        where.createdAt.gte = new Date(query.from_date);
      }
      if (query.to_date) {
        const to = new Date(query.to_date);
        to.setHours(23, 59, 59, 999);
        where.createdAt.lte = to;
      }
    }
    if (query.search) {
      where.OR = [
        { userName: { contains: query.search, mode: 'insensitive' } },
        { userEmail: { contains: query.search, mode: 'insensitive' } },
        { entityId: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await Promise.all([
      prisma.systemAuditLog.count({ where }),
      prisma.systemAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return {
      data: rows.map(r => ({
        id: r.id,
        company_id: r.companyId,
        user_id: r.userId,
        user_name: r.userName,
        user_email: r.userEmail,
        action: r.action,
        entity_name: r.entityName,
        entity_id: r.entityId,
        description: r.description,
        details: r.details,
        ip_address: r.ipAddress,
        created_at: r.createdAt.toISOString(),
      })),
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        pages: Math.ceil(total / query.limit) || 1,
      },
    };
  }

  async record(input: CreateAuditLogInput) {
    return prisma.systemAuditLog.create({
      data: {
        companyId: this.companyId,
        userId: this.actor?.id ?? null,
        userName: this.actor?.fullName ?? 'System',
        userEmail: this.actor?.email ?? null,
        action: input.action.toUpperCase(),
        entityName: input.entity_name,
        entityId: input.entity_id ?? null,
        description: input.description ?? null,
        details: input.details ?? undefined,
        ipAddress: input.ip_address ?? null,
      },
    });
  }
}

/** Static helper to log an action from anywhere in backend */
export async function logAuditEvent(params: {
  companyId: string;
  actor?: AuthUser | null;
  action: string;
  entityName: string;
  entityId?: string | null;
  description?: string | null;
  details?: Record<string, any> | null;
  ipAddress?: string | null;
}) {
  try {
    let validUserId: string | null = null;
    if (params.actor?.id) {
      const exists = await prisma.user.findUnique({ where: { id: params.actor.id }, select: { id: true } });
      if (exists) validUserId = exists.id;
    }
    await prisma.systemAuditLog.create({
      data: {
        companyId: params.companyId,
        userId: validUserId,
        userName: params.actor?.fullName ?? 'System',
        userEmail: params.actor?.email ?? null,
        action: params.action.toUpperCase(),
        entityName: params.entityName,
        entityId: params.entityId ?? null,
        description: params.description ?? null,
        details: params.details ?? undefined,
        ipAddress: params.ipAddress ?? null,
      },
    });
  } catch (error) {
    // Non-blocking error logging
    console.error('Failed to log audit event:', error);
  }
}
