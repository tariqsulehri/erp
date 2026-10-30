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
    if (query.category) {
      const cat = query.category.toLowerCase();
      if (cat === 'approvals') {
        where.action = { in: ['POST', 'APPROVE', 'REQUEST_APPROVAL'] };
      } else if (cat === 'updates') {
        where.action = { in: ['UPDATE', 'EDIT'] };
      } else if (cat === 'deletions') {
        where.action = { in: ['DELETE', 'VOID', 'REVERSE', 'CANCEL'] };
      } else if (cat === 'creations') {
        where.action = { in: ['CREATE'] };
      } else if (cat === 'logins') {
        where.action = { in: ['LOGIN', 'LOGOUT', 'PASSWORD_RESET', 'AUTH', 'FAILED_LOGIN'] };
      } else if (cat === 'four_eyes') {
        where.action = { in: ['APPROVE', 'POST', 'REJECT', 'REQUEST_APPROVAL'] };
      }
    }
    if (query.four_eyes === 'verified') {
      where.OR = [
        { action: 'APPROVE' },
        {
          details: {
            path: ['four_eyes_verified'],
            equals: true,
          },
        },
      ];
    } else if (query.four_eyes === 'single') {
      where.action = 'POST';
      where.details = {
        path: ['four_eyes_verified'],
        equals: false,
      };
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
      const searchConditions: Prisma.SystemAuditLogWhereInput[] = [
        { userName: { contains: query.search, mode: 'insensitive' } },
        { userEmail: { contains: query.search, mode: 'insensitive' } },
        { entityId: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchConditions }];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
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
      data: rows.map(r => {
        const details = (r.details as Record<string, any>) ?? null;
        const isFourEyes = details?.four_eyes_verified === true || r.action === 'APPROVE';
        const isSingleOp = r.action === 'POST' && details?.four_eyes_verified === false;
        return {
          id: r.id,
          company_id: r.companyId,
          user_id: r.userId,
          user_name: r.userName,
          user_email: r.userEmail,
          action: r.action,
          entity_name: r.entityName,
          entity_id: r.entityId,
          description: r.description,
          details,
          ip_address: r.ipAddress,
          created_at: r.createdAt.toISOString(),
          four_eyes_verified: isFourEyes,
          single_operator: isSingleOp,
          maker_id: details?.maker_id ?? null,
          checker_id: details?.checker_id ?? null,
        };
      }),
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

  async getStats(filterQuery?: { from_date?: string; to_date?: string }) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
    fourteenDaysAgo.setHours(0, 0, 0, 0);

    const baseWhere: Prisma.SystemAuditLogWhereInput = { companyId: this.companyId };
    if (filterQuery?.from_date || filterQuery?.to_date) {
      baseWhere.createdAt = {};
      if (filterQuery.from_date) baseWhere.createdAt.gte = new Date(filterQuery.from_date);
      if (filterQuery.to_date) {
        const to = new Date(filterQuery.to_date);
        to.setHours(23, 59, 59, 999);
        baseWhere.createdAt.lte = to;
      }
    }

    const [
      totalEvents,
      byActionRaw,
      byEntityRaw,
      byUserRaw,
      todayEvents,
      criticalActions,
      recentCriticalRaw,
      recentActivitiesRaw,
      dailyRows,
      fourEyesVerifiedCount,
      singleOperatorCount,
      pendingVouchersCount,
    ] = await Promise.all([
      prisma.systemAuditLog.count({ where: baseWhere }),
      prisma.systemAuditLog.groupBy({
        by: ['action'],
        where: baseWhere,
        _count: { _all: true },
      }),
      prisma.systemAuditLog.groupBy({
        by: ['entityName'],
        where: baseWhere,
        _count: { _all: true },
      }),
      prisma.systemAuditLog.groupBy({
        by: ['userName', 'userEmail'],
        where: baseWhere,
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
          ...baseWhere,
          action: { in: ['DELETE', 'PASSWORD_RESET', 'VOID', 'REVERSE', 'CANCEL'] },
        },
      }),
      prisma.systemAuditLog.findMany({
        where: {
          ...baseWhere,
          action: { in: ['DELETE', 'PASSWORD_RESET', 'VOID', 'REVERSE', 'CANCEL'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          companyId: true,
          userId: true,
          action: true,
          entityName: true,
          entityId: true,
          userName: true,
          userEmail: true,
          description: true,
          details: true,
          createdAt: true,
          ipAddress: true,
        },
      }),
      prisma.systemAuditLog.findMany({
        where: baseWhere,
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          companyId: true,
          userId: true,
          action: true,
          entityName: true,
          entityId: true,
          userName: true,
          userEmail: true,
          description: true,
          details: true,
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
      prisma.systemAuditLog.count({
        where: {
          ...baseWhere,
          OR: [
            { action: 'APPROVE' },
            {
              details: {
                path: ['four_eyes_verified'],
                equals: true,
              },
            },
          ],
        },
      }),
      prisma.systemAuditLog.count({
        where: {
          ...baseWhere,
          action: 'POST',
          details: {
            path: ['four_eyes_verified'],
            equals: false,
          },
        },
      }),
      prisma.voucher.count({
        where: {
          companyId: this.companyId,
          approvalStatus: 'Pending',
        },
      }),
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

    const actionCountMap = new Map<string, number>();
    for (const item of byActionRaw) {
      actionCountMap.set(item.action.toUpperCase(), item._count._all);
    }

    const approvalsCount = (actionCountMap.get('POST') ?? 0) + (actionCountMap.get('APPROVE') ?? 0) + (actionCountMap.get('REQUEST_APPROVAL') ?? 0);
    const updatesCount = (actionCountMap.get('UPDATE') ?? 0) + (actionCountMap.get('EDIT') ?? 0);
    const deletionsCount = (actionCountMap.get('DELETE') ?? 0) + (actionCountMap.get('VOID') ?? 0) + (actionCountMap.get('REVERSE') ?? 0) + (actionCountMap.get('CANCEL') ?? 0);
    const creationsCount = actionCountMap.get('CREATE') ?? 0;
    const loginsCount = (actionCountMap.get('LOGIN') ?? 0) + (actionCountMap.get('LOGOUT') ?? 0) + (actionCountMap.get('PASSWORD_RESET') ?? 0) + (actionCountMap.get('AUTH') ?? 0) + (actionCountMap.get('FAILED_LOGIN') ?? 0);

    const totalEvaluated = fourEyesVerifiedCount + singleOperatorCount;
    const dualControlRate = totalEvaluated > 0 ? Math.round((fourEyesVerifiedCount / totalEvaluated) * 100) : 100;

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

    const formatRow = (r: typeof recentActivitiesRaw[0]) => {
      const details = (r.details as Record<string, any>) ?? null;
      const isFourEyes = details?.four_eyes_verified === true || r.action === 'APPROVE';
      const isSingleOp = r.action === 'POST' && details?.four_eyes_verified === false;
      return {
        id: r.id,
        company_id: (r as any).companyId ?? this.companyId,
        user_id: (r as any).userId ?? null,
        user_name: r.userName,
        user_email: r.userEmail,
        action: r.action,
        entity_name: r.entityName,
        entity_id: r.entityId,
        description: r.description,
        details,
        ip_address: r.ipAddress,
        created_at: r.createdAt.toISOString(),
        four_eyes_verified: isFourEyes,
        single_operator: isSingleOp,
        maker_id: details?.maker_id ?? null,
        checker_id: details?.checker_id ?? null,
      };
    };

    return {
      metrics: {
        totalEvents,
        activeUsers: Math.max(distinctUsers.length, topUsers.length),
        criticalActions,
        todayEvents,
        topEntity: byEntity[0]?.entity ?? null,
      },
      fourEyesMetrics: {
        dualControlRate,
        fourEyesVerifiedCount,
        singleOperatorCount,
        pendingApprovals: pendingVouchersCount,
        totalEvaluated,
      },
      categoryCounts: {
        all: totalEvents,
        approvals: approvalsCount,
        updates: updatesCount,
        deletions: deletionsCount,
        creations: creationsCount,
        logins: loginsCount,
        fourEyes: fourEyesVerifiedCount,
      },
      dailyActivity: Array.from(dailyMap.values()),
      byAction,
      byEntity,
      topUsers,
      recentCritical: recentCriticalRaw.map(formatRow),
      recentActivities: recentActivitiesRaw.map(formatRow),
    };
  }
}

/** Static helper to log an action from anywhere in backend */
export async function logAuditEvent(params: {
  companyId: string;
  actor?: AuthUser | null;
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  action: string;
  entityName: string;
  entityId?: string | null;
  description?: string | null;
  details?: Record<string, any> | null;
  ipAddress?: string | null;
  createdAt?: Date;
}) {
  try {
    let validUserId: string | null = null;
    let userName = params.actor?.fullName ?? params.userName ?? 'System';
    let userEmail = params.actor?.email ?? params.userEmail ?? null;

    const lookupId = params.actor?.id ?? params.userId;
    if (lookupId) {
      const exists = await prisma.user.findUnique({
        where: { id: lookupId },
        select: { id: true, fullName: true, email: true },
      });
      if (exists) {
        validUserId = exists.id;
        if (!params.actor?.fullName && !params.userName) userName = exists.fullName;
        if (!params.actor?.email && !params.userEmail) userEmail = exists.email;
      }
    }

    await prisma.systemAuditLog.create({
      data: {
        companyId: params.companyId,
        userId: validUserId,
        userName,
        userEmail,
        action: params.action.toUpperCase(),
        entityName: params.entityName,
        entityId: params.entityId ?? null,
        description: params.description ?? null,
        details: params.details ?? undefined,
        ipAddress: params.ipAddress ?? null,
        createdAt: params.createdAt ?? undefined,
      },
    });
  } catch (error) {
    // Non-blocking error logging
    console.error('Failed to log audit event:', error);
  }
}
