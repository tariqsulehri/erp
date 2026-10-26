import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { AccessLevel, AuthUser, UserRole } from '../auth/access-rules.js';
import { accessProblem, hasAllBranchAccess } from '../auth/access-rules.js';
import { hashPassword } from '../auth/password.js';
import type { CreateUserInput, ListUsersQuery, ResetPasswordInput, UpdateUserInput } from './user.schema.js';

function businessError(message: string, statusCode = 400) {
  const error = new Error(message);
  Object.assign(error, { statusCode });
  return error;
}

const userSelect = (companyId: string) => ({
  id: true,
  email: true,
  fullName: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  companyAccess: {
    where: { companyId },
    select: {
      accessLevel: true,
      branch: { select: { id: true, code: true, name: true, city: true } },
      warehouse: { select: { id: true, code: true, name: true } },
    },
  },
}) satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: ReturnType<typeof userSelect> }>;

function mapUser(row: UserRow) {
  const access = row.companyAccess[0];
  return {
    id: row.id,
    email: row.email,
    full_name: row.fullName,
    role: row.role,
    access_level: access?.accessLevel ?? null,
    branch: access?.branch ?? null,
    warehouse: access?.warehouse ?? null,
    is_active: row.isActive,
    last_login_at: row.lastLoginAt,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export class UserService {
  constructor(private readonly companyId: string, private readonly actor: AuthUser) {}

  async list(query: ListUsersQuery) {
    const where: Prisma.UserWhereInput = { companyAccess: { some: { companyId: this.companyId } } };
    if (query.status === 'Active') where.isActive = true;
    if (query.status === 'Inactive') where.isActive = false;
    if (query.role) where.role = query.role;
    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: userSelect(this.companyId),
        orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return {
      data: rows.map(mapUser),
      pagination: { total, page: query.page, limit: query.limit, pages: Math.ceil(total / query.limit) },
    };
  }

  async getById(id: string) {
    const row = await prisma.user.findFirst({
      where: { id, companyAccess: { some: { companyId: this.companyId } } },
      select: userSelect(this.companyId),
    });
    if (!row) throw businessError('User not found.', 404);
    return mapUser(row);
  }

  async create(input: CreateUserInput) {
    this.assertActorCanAssignRole(input.role);
    const access = await this.validateAccess(input.role, input.access_level, input.branch_id, input.warehouse_id);
    await this.assertEmailIsFree(input.email);

    const passwordHash = await hashPassword(input.password);
    const user = await prisma.$transaction(async transaction => {
      const created = await transaction.user.create({
        data: {
          email: input.email,
          fullName: input.full_name,
          passwordHash,
          role: input.role,
          isActive: input.is_active,
          createdById: this.actor.id,
          updatedById: this.actor.id,
        },
      });
      await transaction.userCompanyAccess.create({
        data: { userId: created.id, companyId: this.companyId, ...access, createdById: this.actor.id, updatedById: this.actor.id },
      });
      return created;
    });

    return this.getById(user.id);
  }

  async update(input: UpdateUserInput) {
    const existing = await this.getById(input.id);
    this.assertActorCanEdit(existing.role as UserRole);

    const role = input.role ?? existing.role as UserRole;
    if (input.role && input.role !== existing.role) this.assertActorCanAssignRole(input.role);
    if (input.id === this.actor.id && input.role && input.role !== existing.role) {
      throw businessError('You cannot change your own Role.');
    }
    if (input.id === this.actor.id && input.is_active === false) {
      throw businessError('You cannot make your own account Inactive.');
    }
    if (input.email && input.email !== existing.email) await this.assertEmailIsFree(input.email, input.id);
    const changesSharedIdentity = (input.email !== undefined && input.email !== existing.email)
      || (input.role !== undefined && input.role !== existing.role)
      || (input.is_active !== undefined && input.is_active !== existing.is_active);
    if (changesSharedIdentity) await this.assertActorManagesEveryCompanyOf(input.id, 'change the Email, Role or Status of');

    // Admin and Top Management always get All Branches, so their branch and warehouse are cleared.
    const accessLevel: AccessLevel = hasAllBranchAccess(role)
      ? 'ALL_BRANCHES'
      : input.access_level ?? (existing.access_level as AccessLevel);
    const branchId = input.branch_id !== undefined ? input.branch_id : existing.branch?.id ?? null;
    const warehouseId = input.warehouse_id !== undefined ? input.warehouse_id : existing.warehouse?.id ?? null;
    const access = await this.validateAccess(role, accessLevel, branchId, warehouseId);

    await prisma.$transaction(async transaction => {
      await transaction.user.update({
        where: { id: input.id },
        data: {
          ...(input.full_name !== undefined && { fullName: input.full_name }),
          ...(input.email !== undefined && { email: input.email }),
          ...(input.role !== undefined && { role: input.role }),
          ...(input.is_active !== undefined && { isActive: input.is_active }),
          updatedById: this.actor.id,
        },
      });
      await transaction.userCompanyAccess.update({
        where: { userId_companyId: { userId: input.id, companyId: this.companyId } },
        data: { ...access, updatedById: this.actor.id },
      });
    });

    return this.getById(input.id);
  }

  async resetPassword(id: string, input: ResetPasswordInput) {
    const existing = await this.getById(id);
    this.assertActorCanEdit(existing.role as UserRole);
    if (id !== this.actor.id && existing.role === 'top_management' && this.actor.role !== 'admin') {
      throw businessError('Only Admin users can reset the password of a Top Management user.', 403);
    }
    await this.assertActorManagesEveryCompanyOf(id, 'reset the password of');

    await prisma.user.update({
      where: { id },
      data: { passwordHash: await hashPassword(input.new_password), passwordChangedAt: new Date(), updatedById: this.actor.id },
    });
    return { message: 'Password reset. The user must sign in again with the new password.' };
  }

  private assertActorCanAssignRole(role: UserRole) {
    if (role === 'admin' && this.actor.role !== 'admin') {
      throw businessError('Only Admin users can create or assign the Admin role.', 403);
    }
  }

  private assertActorCanEdit(targetRole: UserRole) {
    if (targetRole === 'admin' && this.actor.role !== 'admin') {
      throw businessError('Only Admin users can change Admin users.', 403);
    }
  }

  /**
   * Sign-in details (email, password, role, status) are shared by every company a user works in. Only a user
   * who manages all of those companies, or an Admin, may change them.
   */
  private async assertActorManagesEveryCompanyOf(targetUserId: string, actionText: string) {
    if (this.actor.role === 'admin' || targetUserId === this.actor.id) return;
    const targetCompanies = await prisma.userCompanyAccess.findMany({
      where: { userId: targetUserId },
      select: { companyId: true },
    });
    const actorCompanies = new Set(this.actor.access.map(access => access.companyId));
    if (targetCompanies.some(access => !actorCompanies.has(access.companyId))) {
      throw businessError(`This user also works in a company you do not manage, so only an Admin can ${actionText} this user.`, 403);
    }
  }

  private async assertEmailIsFree(email: string, ignoreId?: string) {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM users WHERE lower(email) = lower(${email}) LIMIT 1
    `;
    if (rows[0] && rows[0].id !== ignoreId) throw businessError('Email is already used by another user.');
  }

  /** Checks the role and access combination and that the branch or warehouse is active in this company. */
  private async validateAccess(role: UserRole, accessLevel: AccessLevel, branchId: string | null, warehouseId: string | null) {
    const scopedBranchId = accessLevel === 'BRANCH' ? branchId : null;
    const scopedWarehouseId = accessLevel === 'WAREHOUSE' ? warehouseId : null;

    const problem = accessProblem(role, accessLevel, scopedBranchId, scopedWarehouseId);
    if (problem) throw businessError(problem);

    if (scopedBranchId) {
      const branch = await prisma.branch.findFirst({ where: { id: scopedBranchId, companyId: this.companyId, isActive: true }, select: { id: true } });
      if (!branch) throw businessError('Please select an Active Branch.');
    }
    if (scopedWarehouseId) {
      const warehouse = await prisma.warehouse.findFirst({ where: { id: scopedWarehouseId, companyId: this.companyId, isActive: true }, select: { id: true } });
      if (!warehouse) throw businessError('Please select an Active Warehouse.');
    }

    return { accessLevel, branchId: scopedBranchId, warehouseId: scopedWarehouseId };
  }
}
