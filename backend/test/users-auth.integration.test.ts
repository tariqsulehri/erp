/**
 * Users and sign-in tests against the real database (TEST_DATABASE_URL, or DATABASE_URL from .env).
 * They work inside their own new companies, create users with unique test emails, and remove everything afterwards.
 */
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestCompany, databaseUrl, type TestCompany } from './support/test-database.js';

describe.skipIf(!databaseUrl)('Users and sign-in (database)', () => {
  let prisma: TestCompany['prisma'];
  let company: TestCompany;
  let otherCompany: TestCompany;
  let companyId = '';
  let branchId = '';
  let inactiveBranchId = '';
  let warehouseId = '';
  let UserService: typeof import('../src/modules/users/user.service.js')['UserService'];
  let AuthService: typeof import('../src/modules/auth/auth.service.js')['AuthService'];
  let schemas: typeof import('../src/modules/users/user.schema.js');
  let limiter: typeof import('../src/middleware/login-attempt-limit.js');
  let env: typeof import('../src/config/env.js')['env'];
  type AuthUser = import('../src/modules/auth/access-rules.js').AuthUser;

  const PASSWORD = 'Strong-Pass-123';
  const email = () => `test-${randomUUID()}@example.test`;

  /** An actor that only needs to exist as an object; services read only role, id and access. */
  function actor(role: AuthUser['role'], companyIds = [companyId], id: string = randomUUID()): AuthUser {
    return {
      id, email: 'actor@example.test', fullName: 'Test Actor', role,
      access: companyIds.map(id => ({ companyId: id, accessLevel: 'ALL_BRANCHES' as const, branchId: null, warehouseId: null })),
    };
  }

  function users(role: AuthUser['role'] = 'admin', targetCompanyId = companyId, companyIds = [targetCompanyId]) {
    return new UserService(targetCompanyId, actor(role, companyIds));
  }

  type CreateRaw = Partial<Record<'full_name' | 'email' | 'password' | 'role' | 'access_level' | 'branch_id' | 'warehouse_id', string>> & { is_active?: boolean };

  async function createUser(input: CreateRaw, service = users()) {
    const parsed = schemas.createUserSchema.parse({
      full_name: 'Test User', email: email(), password: PASSWORD, role: 'admin', access_level: 'ALL_BRANCHES', ...input,
    });
    const created = await service.create(parsed);
    company.createdUserIds.push(created.id);
    return created;
  }

  beforeAll(async () => {
    company = await createTestCompany('Users Auth');
    otherCompany = await createTestCompany('Users Auth Other');
    prisma = company.prisma;
    companyId = company.companyId;
    UserService = (await import('../src/modules/users/user.service.js')).UserService;
    AuthService = (await import('../src/modules/auth/auth.service.js')).AuthService;
    schemas = await import('../src/modules/users/user.schema.js');
    limiter = await import('../src/middleware/login-attempt-limit.js');
    env = (await import('../src/config/env.js')).env;

    branchId = (await prisma.branch.create({ data: { companyId, code: 'BR-1', name: 'Main Branch' } })).id;
    inactiveBranchId = (await prisma.branch.create({ data: { companyId, code: 'BR-2', name: 'Closed Branch', isActive: false } })).id;
    warehouseId = (await prisma.warehouse.create({ data: { companyId, code: 'WH-1', name: 'Main Warehouse' } })).id;
  }, 120000);

  afterAll(async () => {
    // The other company goes first so its access rows are gone before the shared users are deleted.
    await otherCompany?.cleanup();
    await company?.cleanup();
    await prisma?.$disconnect();
  }, 120000);

  describe('Create User', () => {
    it('creates users with the access each role needs', async () => {
      const manager = await createUser({ role: 'manager', access_level: 'BRANCH', branch_id: branchId });
      expect(manager.access_level).toBe('BRANCH');
      expect(manager.branch?.id).toBe(branchId);
      expect(manager.warehouse).toBeNull();

      const storeman = await createUser({ role: 'warehouse_staff', access_level: 'WAREHOUSE', warehouse_id: warehouseId });
      expect(storeman.warehouse?.id).toBe(warehouseId);

      const top = await createUser({ role: 'top_management', access_level: 'ALL_BRANCHES' });
      expect(top.access_level).toBe('ALL_BRANCHES');

      const stored = await prisma.user.findUniqueOrThrow({ where: { id: top.id } });
      expect(stored.passwordHash.startsWith('scrypt$')).toBe(true);
      expect(stored.passwordHash).not.toContain(PASSWORD);
    });

    it('refuses role and access combinations that break the access rules', async () => {
      await expect(createUser({ role: 'admin', access_level: 'BRANCH', branch_id: branchId })).rejects.toThrow(/must have All Branches/);
      await expect(createUser({ role: 'manager', access_level: 'ALL_BRANCHES' })).rejects.toThrow(/Only Admin and Top Management/);
      await expect(createUser({ role: 'sales_staff', access_level: 'WAREHOUSE', warehouse_id: warehouseId })).rejects.toThrow(/Sales Staff must be assigned to a Branch/);
      await expect(createUser({ role: 'warehouse_staff', access_level: 'BRANCH', branch_id: branchId })).rejects.toThrow(/Warehouse Staff must be assigned to a Warehouse/);
      await expect(createUser({ role: 'accountant', access_level: 'BRANCH' })).rejects.toThrow(/Please select a Branch/);
      await expect(createUser({ role: 'accountant', access_level: 'BRANCH', branch_id: inactiveBranchId })).rejects.toThrow(/Active Branch/);
      // A branch of another company is not accepted.
      const foreignBranch = await prisma.branch.create({ data: { companyId: otherCompany.companyId, code: 'BR-X', name: 'Foreign Branch' } });
      await expect(createUser({ role: 'accountant', access_level: 'BRANCH', branch_id: foreignBranch.id })).rejects.toThrow(/Active Branch/);
    });

    it('lets only Admin create Admin users', async () => {
      await expect(createUser({ role: 'admin' }, users('top_management'))).rejects.toMatchObject({ statusCode: 403 });
      const top = await createUser({ role: 'top_management' }, users('top_management'));
      expect(top.role).toBe('top_management');
    });

    it('keeps email unique ignoring case', async () => {
      const address = email();
      await createUser({ email: address });
      await expect(createUser({ email: address.toUpperCase() })).rejects.toThrow(/already used/);
      // Bypassing the schema lowercasing must still be caught by the service.
      await expect(users().create({
        full_name: 'Mixed Case', email: address.replace('test-', 'TEST-'), password: PASSWORD, role: 'admin',
        access_level: 'ALL_BRANCHES', branch_id: null, warehouse_id: null, is_active: true,
      })).rejects.toThrow(/already used/);
    });

    it('rejects short passwords in the schema', () => {
      expect(schemas.createUserSchema.safeParse({
        full_name: 'X', email: email(), password: 'short', role: 'admin', access_level: 'ALL_BRANCHES',
      }).success).toBe(false);
    });

    it('lists users of this company only, with search and status filters', async () => {
      const name = `Findable ${randomUUID().slice(0, 6)}`;
      const created = await createUser({ full_name: name, is_active: false } as CreateRaw);
      const list = await users().list(schemas.listUsersQuery.parse({ search: name }));
      expect(list.data.map(row => row.id)).toEqual([created.id]);
      expect((await users().list(schemas.listUsersQuery.parse({ search: name, status: 'Active' }))).data).toHaveLength(0);
      expect((await users().list(schemas.listUsersQuery.parse({ search: name, status: 'Inactive' }))).data).toHaveLength(1);
      // Not visible in another company.
      await expect(users('admin', otherCompany.companyId).getById(created.id)).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('Sign In', () => {
    it('signs in with the right password and any email case, and records the last login', async () => {
      const address = email();
      const user = await createUser({ email: address, role: 'manager', access_level: 'BRANCH', branch_id: branchId });
      const result = await new AuthService().login({ email: address.toUpperCase(), password: PASSWORD });
      expect(result.token).toBeTruthy();
      expect(result.user.id).toBe(user.id);
      expect(result.user.access).toHaveLength(1);
      expect(result.user.access[0]).toMatchObject({ company_id: companyId, access_level: 'BRANCH' });
      const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(stored.lastLoginAt).not.toBeNull();

      const authUser = await new AuthService().authenticate(result.token);
      expect(authUser).toMatchObject({ id: user.id, role: 'manager' });
      expect(authUser.access[0]).toMatchObject({ companyId, accessLevel: 'BRANCH', branchId });
    });

    it('gives the same 401 for a wrong password and an unknown email', async () => {
      const address = email();
      await createUser({ email: address });
      await expect(new AuthService().login({ email: address, password: 'Wrong-Pass-123' }))
        .rejects.toMatchObject({ statusCode: 401, message: 'Email or Password is not correct.' });
      await expect(new AuthService().login({ email: email(), password: PASSWORD }))
        .rejects.toMatchObject({ statusCode: 401, message: 'Email or Password is not correct.' });
    });

    it('refuses inactive users and users whose only branch is inactive', async () => {
      const inactive = email();
      await createUser({ email: inactive, is_active: false } as CreateRaw);
      await expect(new AuthService().login({ email: inactive, password: PASSWORD })).rejects.toMatchObject({ statusCode: 403 });

      const address = email();
      const branch = await prisma.branch.create({ data: { companyId, code: 'BR-3', name: 'Soon Closed' } });
      await createUser({ email: address, role: 'accountant', access_level: 'BRANCH', branch_id: branch.id });
      await prisma.branch.update({ where: { id: branch.id }, data: { isActive: false } });
      await expect(new AuthService().login({ email: address, password: PASSWORD })).rejects.toThrow(/no active Branch or Warehouse/);
    });

    it('rejects bad, foreign-signed and expired tokens', async () => {
      const auth = new AuthService();
      await expect(auth.authenticate('not-a-token')).rejects.toMatchObject({ statusCode: 401 });
      const user = await createUser({});
      const foreign = jwt.sign({ sub: user.id, pwd: null }, 'some-other-secret');
      await expect(auth.authenticate(foreign)).rejects.toMatchObject({ statusCode: 401 });
      const expired = jwt.sign({ sub: user.id, pwd: null, exp: Math.floor(Date.now() / 1000) - 10 }, env.JWT_SECRET);
      await expect(auth.authenticate(expired)).rejects.toMatchObject({ statusCode: 401 });
      const unknown = jwt.sign({ sub: randomUUID(), pwd: null }, env.JWT_SECRET);
      await expect(auth.authenticate(unknown)).rejects.toMatchObject({ statusCode: 401 });
    });

    it('rejects a token after the user is made inactive', async () => {
      const address = email();
      const user = await createUser({ email: address, role: 'manager', access_level: 'BRANCH', branch_id: branchId });
      const { token } = await new AuthService().login({ email: address, password: PASSWORD });
      await users().update({ id: user.id, is_active: false });
      await expect(new AuthService().authenticate(token)).rejects.toMatchObject({ statusCode: 401 });
    });
  });

  describe('Change And Reset Password', () => {
    it('changes the password, signs out older tokens and accepts only the new password', async () => {
      const address = email();
      const user = await createUser({ email: address });
      const auth = new AuthService();
      const { token } = await auth.login({ email: address, password: PASSWORD });

      await expect(auth.changePassword(user.id, { current_password: 'Wrong-Pass-123', new_password: 'New-Pass-456' }))
        .rejects.toThrow(/Current Password is not correct/);
      await expect(auth.changePassword(user.id, { current_password: PASSWORD, new_password: PASSWORD }))
        .rejects.toThrow(/must be different/);

      await auth.changePassword(user.id, { current_password: PASSWORD, new_password: 'New-Pass-456' });
      await expect(auth.authenticate(token)).rejects.toThrow(/password was changed/);
      await expect(auth.login({ email: address, password: PASSWORD })).rejects.toMatchObject({ statusCode: 401 });
      const fresh = await auth.login({ email: address, password: 'New-Pass-456' });
      expect((await auth.authenticate(fresh.token)).id).toBe(user.id);
    });

    it('resets a password, which signs out the user', async () => {
      const address = email();
      const user = await createUser({ email: address, role: 'accountant', access_level: 'BRANCH', branch_id: branchId });
      const auth = new AuthService();
      const { token } = await auth.login({ email: address, password: PASSWORD });
      await users('top_management').resetPassword(user.id, { new_password: 'Reset-Pass-789' });
      await expect(auth.authenticate(token)).rejects.toMatchObject({ statusCode: 401 });
      expect((await auth.login({ email: address, password: 'Reset-Pass-789' })).user.id).toBe(user.id);
    });

    it('lets only Admin reset another Top Management user or change Admin users', async () => {
      const top = await createUser({ role: 'top_management' });
      await expect(users('top_management').resetPassword(top.id, { new_password: 'Reset-Pass-789' }))
        .rejects.toMatchObject({ statusCode: 403, message: expect.stringMatching(/Only Admin users can reset/) });
      await users('admin').resetPassword(top.id, { new_password: 'Reset-Pass-789' });
      // A Top Management user may reset their own password.
      await new UserService(companyId, actor('top_management', [companyId], top.id)).resetPassword(top.id, { new_password: 'Own-Pass-789' });

      const admin = await createUser({ role: 'admin' });
      await expect(users('top_management').resetPassword(admin.id, { new_password: 'Reset-Pass-789' })).rejects.toMatchObject({ statusCode: 403 });
      await expect(users('top_management').update({ id: admin.id, full_name: 'Changed' })).rejects.toMatchObject({ statusCode: 403 });
    });

    it('protects users who also work in a company the actor does not manage', async () => {
      const shared = await createUser({ role: 'manager', access_level: 'BRANCH', branch_id: branchId });
      await prisma.userCompanyAccess.create({ data: { userId: shared.id, companyId: otherCompany.companyId, accessLevel: 'ALL_BRANCHES' } });

      const localTop = users('top_management', companyId, [companyId]);
      await expect(localTop.resetPassword(shared.id, { new_password: 'Reset-Pass-789' }))
        .rejects.toMatchObject({ statusCode: 403, message: expect.stringMatching(/company you do not manage/) });
      await expect(localTop.update({ id: shared.id, is_active: false })).rejects.toMatchObject({ statusCode: 403 });
      // Changing only the name is local to this company and allowed.
      expect((await localTop.update({ id: shared.id, full_name: 'Renamed User' })).full_name).toBe('Renamed User');

      // A Top Management user of both companies, or an Admin, may reset.
      await users('top_management', companyId, [companyId, otherCompany.companyId]).resetPassword(shared.id, { new_password: 'Reset-Pass-789' });
      await users('admin', companyId, [companyId]).resetPassword(shared.id, { new_password: 'Reset-Pass-000' });
    });

    it('does not let users change their own role or make themselves inactive', async () => {
      const top = await createUser({ role: 'top_management' });
      const self = new UserService(companyId, actor('top_management', [companyId], top.id));
      await expect(self.update({ id: top.id, role: 'manager', access_level: 'BRANCH', branch_id: branchId })).rejects.toThrow(/own Role/);
      await expect(self.update({ id: top.id, is_active: false })).rejects.toThrow(/own account Inactive/);
    });
  });

  describe('Login Attempt Limit', () => {
    it('blocks one email from one IP after 10 failures, but not other IPs or emails', () => {
      const ip = `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}-${randomUUID()}`;
      const target = email();
      for (let i = 0; i < 9; i += 1) limiter.recordFailedLogin(target, ip);
      expect(() => limiter.assertLoginAllowed(target, ip)).not.toThrow();
      limiter.recordFailedLogin(target.toUpperCase(), ip);
      expect(() => limiter.assertLoginAllowed(target, ip)).toThrow(expect.objectContaining({ statusCode: 429 }));
      expect(() => limiter.assertLoginAllowed(` ${target.toUpperCase()} `, ip)).toThrow(/Too many/);
      expect(() => limiter.assertLoginAllowed(target, `${ip}-other`)).not.toThrow();
      expect(() => limiter.assertLoginAllowed(email(), ip)).not.toThrow();

      limiter.clearFailedLogins(target, ip);
      expect(() => limiter.assertLoginAllowed(target, ip)).not.toThrow();
    });

    it('blocks an IP after 30 failures across many emails', () => {
      const ip = `ip-${randomUUID()}`;
      for (let i = 0; i < 29; i += 1) limiter.recordFailedLogin(email(), ip);
      expect(() => limiter.assertLoginAllowed(email(), ip)).not.toThrow();
      limiter.recordFailedLogin(email(), ip);
      expect(() => limiter.assertLoginAllowed(email(), ip)).toThrow(expect.objectContaining({ statusCode: 429 }));
      // Clearing one email does not lift the IP block.
      const someone = email();
      limiter.clearFailedLogins(someone, ip);
      expect(() => limiter.assertLoginAllowed(someone, ip)).toThrow(/Too many/);
    });
  });
});
