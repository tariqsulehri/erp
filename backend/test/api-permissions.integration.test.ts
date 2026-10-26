/**
 * HTTP API permission tests: the real Express app on an ephemeral port, real sign-in tokens, and the real
 * database (TEST_DATABASE_URL, or DATABASE_URL from .env). Everything happens inside new test companies with
 * test users, which are removed afterwards.
 */
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestCompany, databaseUrl, type TestCompany } from './support/test-database.js';

type Role = 'admin' | 'top_management' | 'manager' | 'accountant' | 'sales_staff' | 'warehouse_staff' | 'viewer';

describe.skipIf(!databaseUrl)('HTTP API permissions (database)', () => {
  let company: TestCompany;
  let otherCompany: TestCompany;
  let prisma: TestCompany['prisma'];
  let companyId = '';
  let server: Server;
  let baseUrl = '';
  let fiscalYearId = '';
  const tokens = {} as Record<Role, string>;
  const userIds = {} as Record<Role, string>;
  const PASSWORD = 'Api-Test-Pass-123';

  async function request(method: string, path: string, options: { token?: string; companyId?: string | null; body?: unknown; headers?: Record<string, string> } = {}) {
    const headers: Record<string, string> = { ...options.headers };
    if (options.token) headers.authorization = `Bearer ${options.token}`;
    const company = options.companyId === undefined ? companyId : options.companyId;
    if (company) headers['x-company-id'] = company;
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    const response = await fetch(`${baseUrl}${path}`, {
      method, headers, body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    return { status: response.status, body: json, headers: response.headers };
  }

  async function login(email: string, password = PASSWORD) {
    return request('POST', '/api/v1/auth/login', { body: { email, password }, companyId: null });
  }

  /** A JV waiting for approval, created by a different user than any approver below. */
  async function pendingVoucher() {
    const { VoucherService } = await import('../src/modules/vouchers/voucher.service.js');
    const { PostingAccountSettingsService } = await import('../src/modules/settings/posting-account-settings.service.js');
    const settings = await new PostingAccountSettingsService(companyId).get();
    const cashId = String(settings.purchase?.default_cash_account_id);
    const revenueId = String(settings.sale?.sales_revenue_account_id);
    const accounts = await prisma.account.findMany({ where: { id: { in: [cashId, revenueId] } } });
    const byId = new Map(accounts.map(account => [account.id, account]));
    const draft = await new VoucherService(companyId).create({
      voucher_type: 'JV', voucher_date: '2025-08-01', submit_for_approval: true,
      lines: [
        { account_id: cashId, account_code: byId.get(cashId)!.code, account_name: byId.get(cashId)!.name, dr_amount: 10, cr_amount: 0, line_no: 1 },
        { account_id: revenueId, account_code: byId.get(revenueId)!.code, account_name: byId.get(revenueId)!.name, dr_amount: 0, cr_amount: 10, line_no: 2 },
      ],
    } as never, userIds.accountant);
    return draft.id as string;
  }

  beforeAll(async () => {
    company = await createTestCompany('Api Permissions');
    otherCompany = await createTestCompany('Api Permissions Other');
    prisma = company.prisma;
    companyId = company.companyId;

    const { UserService } = await import('../src/modules/users/user.service.js');
    const { createUserSchema } = await import('../src/modules/users/user.schema.js');
    const { FiscalYearService } = await import('../src/modules/fiscal-years/fiscal-year.service.js');
    const { createApp } = await import('../src/app.js');

    const branchId = (await prisma.branch.create({ data: { companyId, code: 'BR-API', name: 'Api Branch' } })).id;
    const warehouseId = (await prisma.warehouse.create({ data: { companyId, code: 'WH-API', name: 'Api Warehouse' } })).id;
    const year = await new FiscalYearService(companyId).create({
      fiscal_year: '2025-2026', year_basis: 'july', start_date: '2025-07-01', end_date: '2026-06-30',
      number_of_periods: 12, posting_cutoff_days: 0,
    } as never);
    fiscalYearId = year.fiscal_year.id;

    const actor = {
      id: randomUUID(), email: 'actor@example.test', fullName: 'Test Actor', role: 'admin' as const,
      access: [{ companyId, accessLevel: 'ALL_BRANCHES' as const, branchId: null, warehouseId: null }],
    };
    const users = new UserService(companyId, actor);
    const accessFor: Record<Role, Record<string, string>> = {
      admin: { access_level: 'ALL_BRANCHES' },
      top_management: { access_level: 'ALL_BRANCHES' },
      manager: { access_level: 'BRANCH', branch_id: branchId },
      accountant: { access_level: 'BRANCH', branch_id: branchId },
      sales_staff: { access_level: 'BRANCH', branch_id: branchId },
      viewer: { access_level: 'BRANCH', branch_id: branchId },
      warehouse_staff: { access_level: 'WAREHOUSE', warehouse_id: warehouseId },
    };

    server = createApp().listen(0);
    await new Promise<void>(resolve => server.once('listening', () => resolve()));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    for (const role of Object.keys(accessFor) as Role[]) {
      const email = `test-${randomUUID()}@example.test`;
      const created = await users.create(createUserSchema.parse({
        full_name: `Api ${role}`, email, password: PASSWORD, role, ...accessFor[role],
      }));
      company.createdUserIds.push(created.id);
      userIds[role] = created.id;
      const result = await login(email);
      expect(result.status).toBe(200);
      tokens[role] = result.body.token;
    }
  }, 120000);

  afterAll(async () => {
    await new Promise<void>(resolve => (server ? server.close(() => resolve()) : resolve()));
    await otherCompany?.cleanup();
    await company?.cleanup();
    await prisma?.$disconnect();
  }, 120000);

  describe('Sign-in and public routes', () => {
    it('keeps health endpoints public', async () => {
      const root = await request('GET', '/health', { companyId: null });
      expect(root.status).toBe(200);
      expect(root.body.status).toBe('ok');
      const database = await request('GET', '/health/database', { companyId: null });
      expect(database.status).toBe(200);
      expect(database.body.database).toBe('postgresql');
      const apiHealth = await request('GET', '/api/v1/health', { companyId: null });
      expect(apiHealth.status).toBe(200);
    });

    it('returns 401 without a token, with a non-Bearer header, or with a bad token', async () => {
      const none = await request('GET', '/api/v1/vouchers');
      expect(none.status).toBe(401);
      expect(none.body.error.message).toMatch(/sign in/i);
      expect((await request('GET', '/api/v1/auth/me', { headers: { authorization: `Basic ${tokens.admin}` } })).status).toBe(401);
      expect((await request('GET', '/api/v1/auth/me', { token: 'not-a-jwt' })).status).toBe(401);
      expect((await request('POST', `/api/v1/vouchers/${randomUUID()}/approve`, { body: {} })).status).toBe(401);
    });

    it('signs in through the real login and returns the profile', async () => {
      const me = await request('GET', '/api/v1/auth/me', { token: tokens.manager });
      expect(me.status).toBe(200);
      expect(me.body.id).toBe(userIds.manager);
      expect(me.body.role).toBe('manager');
      expect(me.body.access.map((row: { company_id: string }) => row.company_id)).toEqual([companyId]);
    });

    it('rejects a wrong password with 401 and a malformed login body with 400', async () => {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userIds.viewer } });
      expect((await login(user.email, 'Wrong-Password-1')).status).toBe(401);
      expect((await request('POST', '/api/v1/auth/login', { body: { email: 'not-an-email' }, companyId: null })).status).toBe(400);
    });

    it('returns an x-request-id header, reusing a safe incoming id', async () => {
      const generated = await request('GET', '/health', { companyId: null });
      expect(generated.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
      const reused = await request('GET', '/api/v1/vouchers', { headers: { 'x-request-id': 'trace-12345678' } });
      expect(reused.status).toBe(401);
      expect(reused.headers.get('x-request-id')).toBe('trace-12345678');
      const unsafe = await request('GET', '/health', { companyId: null, headers: { 'x-request-id': 'bad id!' } });
      expect(unsafe.headers.get('x-request-id')).not.toBe('bad id!');
    });
  });

  describe('Company access', () => {
    it('returns 403 for an x-company-id the user has no access to', async () => {
      for (const role of ['top_management', 'manager', 'accountant', 'viewer'] as Role[]) {
        const response = await request('GET', '/api/v1/vouchers', { token: tokens[role], companyId: otherCompany.companyId });
        expect(response.status, role).toBe(403);
        expect(response.body.error.message).toMatch(/do not have access to this company/);
      }
      const unknown = await request('GET', '/api/v1/vouchers', { token: tokens.manager, companyId: randomUUID() });
      expect(unknown.status).toBe(403);
    });

    it('returns 400 for a malformed x-company-id', async () => {
      const response = await request('GET', '/api/v1/vouchers', { token: tokens.manager, companyId: 'not-a-uuid' });
      expect(response.status).toBe(400);
    });

    it('lets a user read their own company', async () => {
      const response = await request('GET', '/api/v1/vouchers', { token: tokens.viewer });
      expect(response.status).toBe(200);
    });

    it('stops working for a deactivated user straight away', async () => {
      const { UserService } = await import('../src/modules/users/user.service.js');
      const { createUserSchema } = await import('../src/modules/users/user.schema.js');
      const actor = {
        id: randomUUID(), email: 'actor@example.test', fullName: 'Test Actor', role: 'admin' as const,
        access: [{ companyId, accessLevel: 'ALL_BRANCHES' as const, branchId: null, warehouseId: null }],
      };
      const email = `test-${randomUUID()}@example.test`;
      const created = await new UserService(companyId, actor).create(createUserSchema.parse({
        full_name: 'Api Temporary', email, password: PASSWORD, role: 'top_management', access_level: 'ALL_BRANCHES',
      }));
      company.createdUserIds.push(created.id);
      const token = (await login(email)).body.token as string;
      expect((await request('GET', '/api/v1/auth/me', { token })).status).toBe(200);
      await prisma.user.update({ where: { id: created.id }, data: { isActive: false } });
      expect((await request('GET', '/api/v1/auth/me', { token })).status).toBe(401);
    });
  });

  describe('Role permissions', () => {
    it('POST /vouchers/:id/approve: 403 for roles without approval permission', async () => {
      const id = await pendingVoucher();
      for (const role of ['accountant', 'sales_staff', 'warehouse_staff', 'viewer'] as Role[]) {
        const response = await request('POST', `/api/v1/vouchers/${id}/approve`, { token: tokens[role], body: {} });
        expect(response.status, role).toBe(403);
        expect(response.body.error.message).toMatch(/approve or reject vouchers/);
      }
      const voucher = await prisma.voucher.findUniqueOrThrow({ where: { id } });
      expect(voucher.approvalStatus).toBe('Pending');
    });

    it('POST /vouchers/:id/approve: 200 for a manager, 400 for a bad id, 404 for a missing voucher', async () => {
      const id = await pendingVoucher();
      const approved = await request('POST', `/api/v1/vouchers/${id}/approve`, { token: tokens.manager, body: { note: 'ok' } });
      expect(approved.status).toBe(200);
      expect(approved.body.approval_status).toBe('Approved');

      expect((await request('POST', '/api/v1/vouchers/not-a-uuid/approve', { token: tokens.top_management, body: {} })).status).toBe(400);
      const missing = await request('POST', `/api/v1/vouchers/${randomUUID()}/approve`, { token: tokens.admin, body: {} });
      expect(missing.status).toBe(404);
      expect(missing.body.error.message).toMatch(/Voucher was not found/);
    });

    it('PATCH /fiscal-years/:id/close: 403 for roles without fiscal year permission', async () => {
      for (const role of ['manager', 'accountant', 'sales_staff', 'warehouse_staff', 'viewer'] as Role[]) {
        const response = await request('PATCH', `/api/v1/fiscal-years/${fiscalYearId}/close`, { token: tokens[role], body: {} });
        expect(response.status, role).toBe(403);
      }
      const year = await prisma.$queryRaw<{ status: string }[]>`SELECT status FROM fiscal_years WHERE id = CAST(${fiscalYearId} AS uuid)`;
      expect(year[0].status).not.toMatch(/closed/i);
    });

    it('PATCH /fiscal-years/:id/close: allowed roles reach validation (400)', async () => {
      expect((await request('PATCH', '/api/v1/fiscal-years/not-a-uuid/close', { token: tokens.top_management, body: {} })).status).toBe(400);
      // Open periods block closing, so the request is refused by the business rule, not the permission check.
      const blocked = await request('PATCH', `/api/v1/fiscal-years/${fiscalYearId}/close`, { token: tokens.admin, body: {} });
      expect(blocked.status).toBe(400);
    });

    it('PATCH /settings/posting-accounts: 403 for non-managers, 400 for an invalid body from Admin/Top Management', async () => {
      for (const role of ['manager', 'accountant', 'sales_staff', 'warehouse_staff', 'viewer'] as Role[]) {
        const response = await request('PATCH', '/api/v1/settings/posting-accounts', { token: tokens[role], body: {} });
        expect(response.status, role).toBe(403);
        expect(response.body.error.message).toMatch(/change company settings/);
      }
      for (const role of ['admin', 'top_management'] as Role[]) {
        const response = await request('PATCH', '/api/v1/settings/posting-accounts', {
          token: tokens[role], body: { purchase: { default_cash_account_id: 'not-a-uuid' } },
        });
        expect(response.status, role).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      }
      // Reading posting accounts is open to every signed-in user of the company.
      expect((await request('GET', '/api/v1/settings/posting-accounts', { token: tokens.viewer })).status).toBe(200);
    });

    it('GET /reports/trial-balance: 403 for viewer and sales staff, 200/400 for finance roles', async () => {
      for (const role of ['viewer', 'sales_staff', 'warehouse_staff'] as Role[]) {
        const response = await request('GET', '/api/v1/reports/trial-balance?date_to=2025-12-31', { token: tokens[role] });
        expect(response.status, role).toBe(403);
        expect(response.body.error.message).toMatch(/open financial reports/);
      }
      for (const role of ['admin', 'top_management', 'manager', 'accountant'] as Role[]) {
        const response = await request('GET', '/api/v1/reports/trial-balance?date_from=2025-07-01&date_to=2025-12-31', { token: tokens[role] });
        expect(response.status, role).toBe(200);
        expect(response.body.totals.difference).toBe('0.00');
      }
      const missingDate = await request('GET', '/api/v1/reports/trial-balance', { token: tokens.accountant });
      expect(missingDate.status).toBe(400);
    });

    it('does not let a permission check leak another company: allowed role with foreign company gets 403', async () => {
      const response = await request('GET', '/api/v1/reports/trial-balance?date_to=2025-12-31', {
        token: tokens.accountant, companyId: otherCompany.companyId,
      });
      expect(response.status).toBe(403);
    });

    it('limits user management to Admin and Top Management', async () => {
      for (const role of ['manager', 'accountant', 'viewer'] as Role[]) {
        expect((await request('GET', '/api/v1/users', { token: tokens[role] })).status, role).toBe(403);
      }
      const list = await request('GET', '/api/v1/users?limit=200', { token: tokens.top_management });
      expect(list.status).toBe(200);
      const ids = list.body.data.map((row: { id: string }) => row.id);
      expect(ids).toEqual(expect.arrayContaining(Object.values(userIds)));
    });
  });
});
