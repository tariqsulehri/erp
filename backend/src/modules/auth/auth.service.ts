import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import type { AccessLevel, AuthUser, CompanyAccess } from './access-rules.js';
import { hasAllBranchAccess, isUserRole } from './access-rules.js';
import type { ChangePasswordInput, LoginInput } from './auth.schema.js';
import { hashPassword, verifyPassword } from './password.js';

interface TokenPayload {
  sub: string;
  /** The user's password-change time when the token was issued; a later change or reset invalidates the token. */
  pwd: number | null;
}

// Used when the email does not exist, so a wrong email takes as long as a wrong password
// and response time does not reveal which emails are registered.
const UNKNOWN_USER_HASH = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

function businessError(message: string, statusCode = 400) {
  const error = new Error(message);
  Object.assign(error, { statusCode });
  return error;
}

const accessInclude = {
  where: { isActive: true },
  include: {
    company: { select: { id: true, name: true, isActive: true } },
    branch: { select: { id: true, code: true, name: true, city: true, isActive: true } },
    warehouse: { select: { id: true, code: true, name: true, isActive: true } },
  },
} as const;

type UserWithAccess = NonNullable<Awaited<ReturnType<typeof findUserWithAccess>>>;

function findUserWithAccess(where: { id: string }) {
  return prisma.user.findUnique({ where, include: { companyAccess: accessInclude } });
}

/** Access records the user can actually use: company, branch, and warehouse must all still be active. */
function usableAccess(user: UserWithAccess) {
  return user.companyAccess.filter(access =>
    access.company.isActive
    && (!access.branch || access.branch.isActive)
    && (!access.warehouse || access.warehouse.isActive));
}

function mapProfile(user: UserWithAccess) {
  return {
    id: user.id,
    email: user.email,
    full_name: user.fullName,
    role: user.role,
    last_login_at: user.lastLoginAt,
    access: usableAccess(user).map(access => ({
      company_id: access.companyId,
      company_name: access.company.name,
      access_level: access.accessLevel as AccessLevel,
      branch: access.branch ? { id: access.branch.id, code: access.branch.code, name: access.branch.name, city: access.branch.city } : null,
      warehouse: access.warehouse ? { id: access.warehouse.id, code: access.warehouse.code, name: access.warehouse.name } : null,
    })),
  };
}

export class AuthService {
  async login(input: LoginInput) {
    const rows = await prisma.$queryRaw<{ id: string; password_hash: string; is_active: boolean }[]>`
      SELECT id, password_hash, is_active
      FROM users
      WHERE lower(email) = lower(${input.email})
      LIMIT 1
    `;
    const found = rows[0];
    const passwordMatches = await verifyPassword(input.password, found?.password_hash ?? UNKNOWN_USER_HASH);
    if (!found || !passwordMatches) throw businessError('Email or Password is not correct.', 401);
    if (!found.is_active) throw businessError('Your account is Inactive. Please contact your administrator.', 403);

    const user = await findUserWithAccess({ id: found.id });
    if (!user || !isUserRole(user.role)) throw businessError('Your account is not set up correctly. Please contact your administrator.', 403);
    if (user.role !== 'admin' && usableAccess(user).length === 0) {
      throw businessError('Your account has no active Branch or Warehouse access. Please contact your administrator.', 403);
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const payload: TokenPayload = { sub: user.id, pwd: user.passwordChangedAt?.getTime() ?? null };
    const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
    return { token, expires_in: env.JWT_EXPIRES_IN, user: mapProfile(user) };
  }

  /** Reads the signed-in user fresh from the database, so deactivation and access changes apply immediately. */
  async authenticate(token: string): Promise<AuthUser> {
    let payload: TokenPayload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    } catch {
      throw businessError('Your session has expired. Please sign in again.', 401);
    }

    const user = typeof payload.sub === 'string' ? await findUserWithAccess({ id: payload.sub }) : null;
    if (!user || !user.isActive || !isUserRole(user.role)) {
      throw businessError('Your session is no longer valid. Please sign in again.', 401);
    }
    // A password change or reset signs out every session started before it.
    if ((user.passwordChangedAt?.getTime() ?? null) !== (payload.pwd ?? null)) {
      throw businessError('Your password was changed. Please sign in again.', 401);
    }

    const access: CompanyAccess[] = usableAccess(user).map(row => ({
      companyId: row.companyId,
      accessLevel: hasAllBranchAccess(user.role as AuthUser['role']) ? 'ALL_BRANCHES' : row.accessLevel as AccessLevel,
      branchId: row.branchId,
      warehouseId: row.warehouseId,
    }));

    return { id: user.id, email: user.email, fullName: user.fullName, role: user.role, access };
  }

  async profile(userId: string) {
    const user = await findUserWithAccess({ id: userId });
    if (!user) throw businessError('User not found.', 404);
    return mapProfile(user);
  }

  async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
    if (!user || !(await verifyPassword(input.current_password, user.passwordHash))) {
      // The route counts only this error towards the failed sign-in limit.
      throw Object.assign(businessError('Current Password is not correct.'), { code: 'WRONG_PASSWORD' });
    }
    if (input.current_password === input.new_password) {
      throw businessError('New Password must be different from Current Password.');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(input.new_password), passwordChangedAt: new Date(), updatedById: userId },
    });
    return { message: 'Password changed. Please sign in again with your new password.' };
  }
}
