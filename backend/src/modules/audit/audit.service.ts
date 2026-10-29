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

  async getStats() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
    fourteenDaysAgo.setHours(0, 0, 0, 0);

    const [
      totalEvents,
      byActionRaw,
      byEntityRaw,
      byUserRaw,
      todayEvents,
      criticalActions,
      recentCriticalRaw,
      dailyRows,
    ] = await Promise.all([
      prisma.systemAuditLog.count({ where: { companyId: this.companyId } }),
      prisma.systemAuditLog.groupBy({
        by: ['action'],
        where: { companyId: this.companyId },
        _count: { _all: true },
      }),
      prisma.systemAuditLog.groupBy({
        by: ['entityName'],
        where: { companyId: this.companyId },
        _count: { _all: true },
      }),
      prisma.systemAuditLog.groupBy({
        by: ['userName', 'userEmail'],
        where: { companyId: this.companyId },
        _count: { _all: true },
      }),
      prisma.systemAuditLog.count({
        where: {
          companyId: this.companyId,
          createdAt: { gte: startOfToday },
        },
      }),
      prisma.systemAuditLog.count({
        where: {
          companyId: this.companyId,
          action: { in: ['DELETE', 'PASSWORD_RESET', 'VOID', 'REVERSE', 'CANCEL'] },
        },
      }),
      prisma.systemAuditLog.findMany({
        where: {
          companyId: this.companyId,
          action: { in: ['DELETE', 'PASSWORD_RESET', 'VOID', 'REVERSE', 'CANCEL'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          action: true,
          entityName: true,
          entityId: true,
          userName: true,
          userEmail: true,
          description: true,
          createdAt: true,
          ipAddress: true,
        },
      }),
      prisma.$queryRaw<Array<{ day: string; label: string; count: bigint }>>`
        SELECT
          TO_CHAR(created_at, 'YYYY-MM-DD') AS day,
          TO_CHAR(created_at, 'Mon DD') AS label,
          COUNT(*)::bigint AS count
        FROM system_audit_logs
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND created_at >= ${fourteenDaysAgo}
        GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD'), TO_CHAR(created_at, 'Mon DD')
        ORDER BY TO_CHAR(created_at, 'YYYY-MM-DD') ASC
      `,
    ]);

    // Build complete 14-day timeline map
    const dailyMap = new Map<string, { day: string; label: string; count: number }>();
    const cur = new Date(fourteenDaysAgo);
    const today = new Date();
    while (cur <= today) {
      const dayStr = cur.toISOString().slice(0, 10);
      const labelStr = cur.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
      dailyMap.set(dayStr, { day: dayStr, label: labelStr, count: 0 });
      cur.setDate(cur.getDate() + 1);
    }
    for (const row of dailyRows) {
      if (dailyMap.has(row.day)) {
        dailyMap.set(row.day, {
          day: row.day,
          label: row.label ?? dailyMap.get(row.day)!.label,
          count: Number(row.count),
        });
      }
    }

    const byAction = byActionRaw
      .map(item => ({
        action: item.action,
        count: item._count._all,
        percentage: totalEvents > 0 ? Math.round((item._count._all / totalEvents) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const byEntity = byEntityRaw
      .map(item => ({
        entity: item.entityName,
        count: item._count._all,
        percentage: totalEvents > 0 ? Math.round((item._count._all / totalEvents) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const topUsers = byUserRaw
      .map(item => ({
        userName: item.userName,
        userEmail: item.userEmail,
        count: item._count._all,
        percentage: totalEvents > 0 ? Math.round((item._count._all / totalEvents) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const distinctUsers = await prisma.systemAuditLog.groupBy({
      by: ['userId'],
      where: { companyId: this.companyId, userId: { not: null } },
    });

    return {
      metrics: {
        totalEvents,
        activeUsers: Math.max(distinctUsers.length, topUsers.length),
        criticalActions,
        todayEvents,
        topEntity: byEntity[0]?.entity ?? null,
      },
      dailyActivity: Array.from(dailyMap.values()),
      byAction,
      byEntity,
      topUsers,
      recentCritical: recentCriticalRaw.map(r => ({
        id: r.id,
        action: r.action,
        entityName: r.entityName,
        entityId: r.entityId,
        userName: r.userName,
        userEmail: r.userEmail,
        description: r.description,
        createdAt: r.createdAt.toISOString(),
        ipAddress: r.ipAddress,
      })),
    };
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
