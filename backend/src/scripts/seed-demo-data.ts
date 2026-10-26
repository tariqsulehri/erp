import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { prisma } from '../db/prisma.js';
import type { AccessScope, AuthUser } from '../modules/auth/access-rules.js';
import { hashPassword } from '../modules/auth/password.js';
import { BankChequeService } from '../modules/bank-cheques/bank-cheque.service.js';
import { BranchService } from '../modules/branches/branch.service.js';
import { PurchaseDraftService } from '../modules/purchases/purchase-draft.service.js';
import { PurchasePostService } from '../modules/purchases/purchase-post.service.js';
import { PurchaseReturnDraftService } from '../modules/purchase-returns/purchase-return-draft.service.js';
import { PurchaseReturnPostService } from '../modules/purchase-returns/purchase-return-post.service.js';
import { SaleDraftService } from '../modules/sales/sale-draft.service.js';
import { SalePostService } from '../modules/sales/sale-post.service.js';
import { SaleReturnDraftService } from '../modules/sale-returns/sale-return-draft.service.js';
import { SaleReturnPostService } from '../modules/sale-returns/sale-return-post.service.js';
import { StockAdjustmentService } from '../modules/stock-adjustments/stock-adjustment.service.js';
import { StockTransferService } from '../modules/stock-transfers/stock-transfer.service.js';
import { UserService } from '../modules/users/user.service.js';
import { VoucherService } from '../modules/vouchers/voucher.service.js';

/**
 * Demo data for a test environment: fills every module with realistic records through the same services
 * the screens use, so ledger entries, stock movements and document numbers are all correct.
 *
 * Usage: DEMO_COMPANY_ID=<company id> npm run seed:demo   (defaults to the only active company)
 * Running it again does nothing: it stops when it finds its own marker (branch code BR-DEMO).
 * Never run it on a production database.
 */

const MARKER_BRANCH_CODE = 'BR-DEMO';
const DEMO_REFERENCE = 'DEMO DATA';
// Test environment only: every demo user shares one simple password (override with DEMO_USER_PASSWORD).
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD || '1234';

function plusDays(dateText: string, days: number) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function log(message: string) {
  console.log(`- ${message}`);
}

async function one<T>(query: Promise<T[]>, label: string): Promise<T> {
  const rows = await query;
  if (!rows[0]) throw new Error(`Demo data needs ${label}, but none was found.`);
  return rows[0];
}

async function main() {
  const companies = await prisma.company.findMany({ where: { isActive: true }, select: { id: true, name: true } });
  const companyId = process.env.DEMO_COMPANY_ID ?? (companies.length === 1 ? companies[0].id : '');
  if (!companyId) throw new Error('More than one company exists. Set DEMO_COMPANY_ID.');
  const company = companies.find(item => item.id === companyId);
  if (!company) throw new Error(`Company ${companyId} was not found or is inactive.`);
  console.log(`Adding demo data to "${company.name}"`);

  const existing = await prisma.branch.findFirst({ where: { companyId, code: MARKER_BRANCH_CODE } });
  if (existing) {
    console.log('Demo data is already loaded (branch BR-DEMO exists). Nothing changed.');
    return;
  }

  const admin = await one(prisma.$queryRaw<Array<{ id: string; email: string; full_name: string }>>`
    SELECT u.id::text, u.email, u.full_name FROM users u
    JOIN user_company_access a ON a.user_id = u.id AND a.company_id = CAST(${companyId} AS uuid)
    WHERE u.role = 'admin' AND u.is_active = true ORDER BY u.created_at LIMIT 1`, 'an active Admin user');
  const adminActor: AuthUser = {
    id: admin.id, email: admin.email, fullName: admin.full_name, role: 'admin',
    access: [{ companyId, accessLevel: 'ALL_BRANCHES', branchId: null, warehouseId: null }],
  };
  const scope: AccessScope = { companyId, userId: admin.id, role: 'admin', accessLevel: 'ALL_BRANCHES', branchId: null, warehouseId: null };

  // ── Reference data that has no screen yet (dimensions, deposit types, unit conversions) ──
  for (const [code, name] of [['CC-HO', 'Head Office'], ['CC-SALES', 'Sales And Marketing'], ['CC-WH', 'Warehouse Operations']]) {
    await prisma.$executeRaw`INSERT INTO cost_centers (company_id, code, name, is_active) VALUES (CAST(${companyId} AS uuid), ${code}, ${name}, true) ON CONFLICT DO NOTHING`;
  }
  for (const [code, name] of [['FIN', 'Finance'], ['SAL', 'Sales'], ['PUR', 'Purchasing'], ['STR', 'Stores']]) {
    await prisma.$executeRaw`INSERT INTO departments (company_id, code, name, is_active) VALUES (CAST(${companyId} AS uuid), ${code}, ${name}, true) ON CONFLICT DO NOTHING`;
  }
  await prisma.$executeRaw`INSERT INTO projects (company_id, code, name, start_date, is_active) VALUES (CAST(${companyId} AS uuid), 'PRJ-SHOWROOM', 'New Showroom Fit-Out', '2026-08-01', true) ON CONFLICT DO NOTHING`;
  for (const [code, name, kind, order] of [['CASH', 'Cash Deposit', 'CASH', 1], ['CHQ', 'Cheque Deposit', 'CHEQUE', 2], ['IBFT', 'Bank Transfer', 'BANK_TRANSFER', 3]] as const) {
    await prisma.$executeRaw`INSERT INTO bank_deposit_types (company_id, code, name, deposit_kind, sort_order, is_active) VALUES (CAST(${companyId} AS uuid), ${code}, ${name}, ${kind}, ${order}, true) ON CONFLICT DO NOTHING`;
  }
  const uom = async (code: string) => (await prisma.$queryRaw<Array<{ id: string }>>`SELECT id::text FROM inventory_units_of_measure WHERE company_id = CAST(${companyId} AS uuid) AND code = ${code} LIMIT 1`)[0]?.id;
  const [box, pcs, roll, mtr] = await Promise.all([uom('BOX'), uom('PCS'), uom('ROLL'), uom('MTR')]);
  if (box && pcs) await prisma.$executeRaw`INSERT INTO inventory_unit_conversions (company_id, from_unit_id, to_unit_id, factor, is_active) VALUES (CAST(${companyId} AS uuid), CAST(${box} AS uuid), CAST(${pcs} AS uuid), 12, true) ON CONFLICT DO NOTHING`;
  if (roll && mtr) await prisma.$executeRaw`INSERT INTO inventory_unit_conversions (company_id, from_unit_id, to_unit_id, factor, is_active) VALUES (CAST(${companyId} AS uuid), CAST(${roll} AS uuid), CAST(${mtr} AS uuid), 50, true) ON CONFLICT DO NOTHING`;
  log('Cost centers, departments, project, bank deposit types and unit conversions');

  // ── Branches and demo users (an accountant enters vouchers, a manager approves them) ──
  const branchService = new BranchService(companyId);
  const demoBranch = await branchService.create({
    code: MARKER_BRANCH_CODE, name: 'Karachi Saddar Branch', city: 'Karachi', address: 'Main Saddar Road, Karachi',
    phone: '021-35550000', manager_name: 'Demo Branch Manager', description: 'Demo branch created by the demo data script.',
    is_default: false, is_active: true,
  } as never) as { id: string };
  const mainBranch = await one(prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id::text FROM branches WHERE company_id = CAST(${companyId} AS uuid) AND is_active = true AND code <> ${MARKER_BRANCH_CODE} ORDER BY is_default DESC, code LIMIT 1`, 'an active Branch');
  log('Branch BR-DEMO (Karachi Saddar Branch)');

  const users = new UserService(companyId, adminActor);
  const passwords: Record<string, string> = {};
  const demoUser = async (email: string, fullName: string, role: 'accountant' | 'manager') => {
    const found = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id::text FROM users WHERE lower(email) = ${email}`;
    if (found[0]) return found[0].id;
    // The service enforces the minimum length, so create with a temporary password and then set the shared test password.
    const created = await users.create({ full_name: fullName, email, password: `Demo-${randomBytes(6).toString('hex')}`, role, access_level: 'BRANCH', branch_id: mainBranch.id, is_active: true } as never);
    const id = (created as { id: string }).id;
    await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(DEMO_PASSWORD) } });
    passwords[email] = DEMO_PASSWORD;
    return id;
  };
  const accountantId = await demoUser('accountant@example.com', 'Demo Accountant', 'accountant');
  const managerId = await demoUser('manager@example.com', 'Demo Manager', 'manager');
  log('Users accountant@example.com (Accountant) and manager@example.com (Manager)');

  // ── Existing master data to build documents from ──
  const warehouse = await one(prisma.$queryRaw<Array<{ id: string; name: string }>>`
    SELECT w.id::text, w.name FROM inventory_warehouses w
    WHERE w.company_id = CAST(${companyId} AS uuid) AND w.is_active = true AND w.use_locations = false
    ORDER BY (SELECT count(*) FROM inventory_stock_balances b WHERE b.warehouse_id = w.id) DESC LIMIT 1`, 'a Warehouse without location control');
  const suppliers = await prisma.$queryRaw<Array<{ id: string; name: string; ap_account_id: string }>>`
    SELECT id::text, name, ap_account_id::text FROM suppliers WHERE company_id = CAST(${companyId} AS uuid) AND is_active = true AND ap_account_id IS NOT NULL ORDER BY code LIMIT 5`;
  const customers = await prisma.$queryRaw<Array<{ id: string; name: string; ar_account_id: string }>>`
    SELECT id::text, name, ar_account_id::text FROM customers WHERE company_id = CAST(${companyId} AS uuid) AND is_active = true AND ar_account_id IS NOT NULL ORDER BY code LIMIT 6`;
  const items = await prisma.$queryRaw<Array<{ id: string; name: string; price: string }>>`
    SELECT i.id::text, i.item_name AS name,
           COALESCE(NULLIF(i.default_purchase_price, 0), NULLIF(b.average_cost, 0), 500)::text AS price
    FROM inventory_items i
    LEFT JOIN inventory_stock_balances b ON b.item_id = i.id AND b.warehouse_id = CAST(${warehouse.id} AS uuid)
    WHERE i.company_id = CAST(${companyId} AS uuid) AND i.is_active = true AND i.is_blocked = false AND i.is_inventory_item = true
    ORDER BY i.item_code LIMIT 8`;
  if (suppliers.length < 2 || customers.length < 3 || items.length < 6) {
    throw new Error('Demo data needs at least 2 suppliers, 3 customers and 6 stock items with linked accounts.');
  }
  const cost = (index: number) => Math.max(10, Math.round(Number(items[index].price)));

  // ── Purchases into the warehouse (some with discount and tax), then one purchase return ──
  const purchaseDraft = new PurchaseDraftService(companyId);
  const purchasePost = new PurchasePostService(companyId);
  const purchasePlan = [
    { date: '2026-07-08', supplier: 0, pay: 'Credit', lines: [[0, 120, 0, 0], [1, 80, 500, 0]] },
    { date: '2026-07-22', supplier: 1, pay: 'Credit', lines: [[2, 60, 0, 1800], [3, 40, 0, 0]] },
    { date: '2026-08-05', supplier: 0, pay: 'Cash', lines: [[4, 50, 0, 0], [5, 30, 250, 0]] },
    { date: '2026-08-26', supplier: 1, pay: 'Credit', lines: [[0, 60, 0, 0], [2, 40, 0, 1200]] },
    { date: '2026-09-15', supplier: Math.min(2, suppliers.length - 1), pay: 'Credit', lines: [[1, 50, 0, 0], [3, 30, 300, 0]] },
    { date: '2026-10-06', supplier: 0, pay: 'Credit', lines: [[4, 40, 0, 0], [5, 30, 0, 900]] },
  ] as const;
  for (const [index, plan] of purchasePlan.entries()) {
    const draft = await purchaseDraft.createDraft({
      purchase_date: plan.date, supplier_id: suppliers[plan.supplier].id, payment_type: plan.pay, warehouse_id: warehouse.id,
      due_date: plan.pay === 'Credit' ? plusDays(plan.date, 30) : undefined,
      supplier_invoice_number: `SUP-INV-${7001 + index}`, reference_number: DEMO_REFERENCE, description: 'Demo stock purchase', freight_amount: 0,
      lines: plan.lines.map(([item, quantity, discount, tax]) => ({ item_id: items[item].id, quantity, purchase_price: cost(item), discount_amount: discount, tax_amount: tax })),
    }, admin.id) as { id: string };
    await purchasePost.post(draft.id, admin.id);
  }
  log(`${purchasePlan.length} posted Purchase Vouchers into ${warehouse.name}`);

  const purchaseReturn = await new PurchaseReturnDraftService(companyId).createDraft({
    purchase_return_date: '2026-09-02', supplier_id: suppliers[0].id, payment_type: 'Credit', warehouse_id: warehouse.id,
    supplier_return_number: 'DN-SUP-301', reference_number: DEMO_REFERENCE, description: 'Damaged items returned to supplier', freight_amount: 0,
    lines: [{ item_id: items[0].id, quantity: 5, purchase_price: cost(0), discount_amount: 0, tax_amount: 0 }],
  }, admin.id) as { id: string };
  await new PurchaseReturnPostService(companyId).post(purchaseReturn.id, admin.id);
  log('1 posted Purchase Return');

  // ── Stock to the branches, an adjustment, then sales and a sale return at the branches ──
  const transfers = new StockTransferService(companyId, scope);
  for (const [date, branchId, quantities] of [
    ['2026-07-25', mainBranch.id, [40, 30, 25, 15, 0, 0]],
    ['2026-08-28', demoBranch.id, [35, 20, 20, 10, 20, 10]],
  ] as const) {
    await transfers.createAndPost({
      transfer_date: date, from_warehouse_id: warehouse.id, to_branch_id: branchId, reference_number: DEMO_REFERENCE,
      description: 'Demo stock sent to branch',
      lines: quantities.map((quantity, item) => ({ item_id: items[item].id, quantity })).filter(line => line.quantity > 0),
    }, admin.id);
  }
  log('2 posted Stock Transfers (Warehouse to Branches)');

  await new StockAdjustmentService(companyId, scope).createAndPost({
    adjustment_date: '2026-09-30', warehouse_id: warehouse.id, reference_number: DEMO_REFERENCE, reason: 'Quarterly stock count',
    description: 'Demo stock count differences',
    lines: [
      { adjustment_type: 'Decrease', item_id: items[1].id, quantity: 2, unit_cost: 0, description: 'Damaged in storage' },
      { adjustment_type: 'Increase', item_id: items[3].id, quantity: 1, unit_cost: cost(3), description: 'Found during count' },
    ],
  }, admin.id);
  log('1 posted Stock Adjustment');

  const saleDraft = new SaleDraftService(companyId);
  const salePost = new SalePostService(companyId);
  const salePlan = [
    { date: '2026-08-02', branch: mainBranch.id, customer: 0, pay: 'Credit', lines: [[0, 10], [1, 6]] },
    { date: '2026-08-12', branch: mainBranch.id, customer: 1, pay: 'Cash', lines: [[2, 5]] },
    { date: '2026-08-30', branch: demoBranch.id, customer: 2, pay: 'Credit', lines: [[0, 8], [4, 5]] },
    { date: '2026-09-10', branch: mainBranch.id, customer: 0, pay: 'Credit', lines: [[3, 4], [1, 5]] },
    { date: '2026-09-21', branch: demoBranch.id, customer: Math.min(3, customers.length - 1), pay: 'Cash', lines: [[2, 6], [5, 3]] },
    { date: '2026-10-03', branch: mainBranch.id, customer: 1, pay: 'Credit', lines: [[0, 9], [2, 4]] },
    { date: '2026-10-14', branch: demoBranch.id, customer: 2, pay: 'Credit', lines: [[1, 6], [4, 4]] },
    { date: '2026-10-20', branch: demoBranch.id, customer: Math.min(4, customers.length - 1), pay: 'Credit', lines: [[0, 7], [3, 3]] },
  ] as const;
  for (const [index, plan] of salePlan.entries()) {
    const draft = await saleDraft.createDraft({
      sale_date: plan.date, customer_id: customers[plan.customer].id, payment_type: plan.pay, branch_id: plan.branch,
      due_date: plan.pay === 'Credit' ? plusDays(plan.date, 30) : undefined,
      customer_reference_number: `CUST-PO-${8101 + index}`, description: 'Demo sale', freight_amount: 0,
      lines: plan.lines.map(([item, quantity]) => ({
        item_id: items[item].id, quantity, sale_price: Math.round(cost(item) * 1.35), discount_amount: 0, tax_amount: Math.round(cost(item) * 1.35 * quantity * 0.18),
      })),
    }, admin.id) as { id: string };
    await salePost.post(draft.id, admin.id, scope);
  }
  log(`${salePlan.length} posted Sale Vouchers at two Branches`);

  const saleReturn = await new SaleReturnDraftService(companyId).createDraft({
    sale_return_date: '2026-10-08', customer_id: customers[0].id, payment_type: 'Credit', branch_id: mainBranch.id,
    customer_return_number: 'CR-1101', reference_number: DEMO_REFERENCE, description: 'Customer returned wrong size', freight_amount: 0,
    lines: [{ item_id: items[1].id, quantity: 1, sale_price: Math.round(cost(1) * 1.35), discount_amount: 0, tax_amount: 0 }],
  }, admin.id) as { id: string };
  await new SaleReturnPostService(companyId).post(saleReturn.id, admin.id, scope);
  log('1 posted Sale Return');

  // ── Vouchers: entered by the accountant, approved by the manager, posted by the accountant ──
  const account = async (id: string) => one(prisma.$queryRaw<Array<{ id: string; code: string; name: string }>>`
    SELECT id::text, code, name FROM accounts WHERE id = CAST(${id} AS uuid)`, 'an account');
  const cashSetting = await one(prisma.$queryRaw<Array<{ id: string }>>`SELECT default_cash_account_id::text AS id FROM purchase_settings WHERE company_id = CAST(${companyId} AS uuid)`, 'purchase settings');
  const cash = await account(cashSetting.id);
  const bankAccount = await one(prisma.$queryRaw<Array<{ id: string; ledger_account_id: string; bank_name: string }>>`
    SELECT id::text, ledger_account_id::text, bank_name FROM bank_accounts WHERE company_id = CAST(${companyId} AS uuid) AND is_active = true ORDER BY code LIMIT 1`, 'an active Bank Account');
  const bank = await account(bankAccount.ledger_account_id);
  const expenses = await prisma.$queryRaw<Array<{ id: string; code: string; name: string }>>`
    SELECT id::text, code, name FROM accounts
    WHERE company_id = CAST(${companyId} AS uuid) AND account_type = 'Expense' AND is_posting = true AND is_active = true AND is_deleted = false
      AND id NOT IN (SELECT cost_of_goods_sold_account_id FROM sale_settings WHERE company_id = CAST(${companyId} AS uuid))
      AND id NOT IN (SELECT COALESCE(sales_discount_account_id, cost_of_goods_sold_account_id) FROM sale_settings WHERE company_id = CAST(${companyId} AS uuid))
      AND id NOT IN (SELECT COALESCE(purchase_discount_account_id, default_cash_account_id) FROM purchase_settings WHERE company_id = CAST(${companyId} AS uuid))
    ORDER BY code LIMIT 3`;
  if (!expenses.length) throw new Error('Demo vouchers need at least one Expense posting account.');
  const customerAccount = await account(customers[0].ar_account_id);
  const customerAccount2 = await account(customers[1].ar_account_id);
  const supplierAccount = await account(suppliers[0].ap_account_id);

  const vouchers = new VoucherService(companyId);
  const line = (acc: { id: string; code: string; name: string }, debit: number, credit: number, narration: string, lineNo: number) => ({
    account_id: acc.id, account_code: acc.code, account_name: acc.name, dr_amount: debit, cr_amount: credit, narration, line_no: lineNo,
  });
  const voucherPlan = [
    { type: 'CRV', date: '2026-08-20', ref: 'Receipt 501', text: 'Cash received from customer', lines: [line(cash, 25000, 0, 'Cash received', 1), line(customerAccount, 0, 25000, 'Payment against invoice', 2)], finish: 'post' },
    { type: 'BRV', date: '2026-09-05', ref: 'Online 7781', text: 'Customer paid by bank transfer', lines: [line(bank, 40000, 0, 'Bank receipt', 1), line(customerAccount2, 0, 40000, 'Payment against invoices', 2)], finish: 'post' },
    { type: 'BPV', date: '2026-09-18', ref: 'Chq 1000002', text: 'Supplier payment by cheque', lines: [line(bank, 0, 60000, 'Cheque issued', 1), line(supplierAccount, 60000, 0, 'Payment of supplier bills', 2)], finish: 'post' },
    { type: 'CPV', date: '2026-10-01', ref: 'Petty 33', text: 'Office expenses paid in cash', lines: [line(cash, 0, 7500, 'Cash paid', 1), line(expenses[0], 7500, 0, 'Monthly office expenses', 2)], finish: 'post' },
    { type: 'JV', date: '2026-10-15', ref: 'Accrual 10', text: 'Expense accrual for October', lines: [line(expenses[Math.min(1, expenses.length - 1)], 12000, 0, 'October accrual', 1), line(supplierAccount, 0, 12000, 'Amount payable', 2)], finish: 'post' },
    { type: 'JV', date: '2026-10-22', ref: 'Accrual 11', text: 'Waiting for manager approval', lines: [line(expenses[0], 3000, 0, 'Pending accrual', 1), line(supplierAccount, 0, 3000, 'Amount payable', 2)], finish: 'pending' },
    { type: 'CPV', date: '2026-10-24', ref: 'Petty 34', text: 'Draft cash payment, not sent for approval', lines: [line(cash, 0, 1500, 'Cash paid', 1), line(expenses[0], 1500, 0, 'Tea and refreshments', 2)], finish: 'draft' },
  ] as const;
  for (const plan of voucherPlan) {
    const created = await vouchers.create({
      voucher_type: plan.type, voucher_date: plan.date, reference: plan.ref, narration: plan.text,
      submit_for_approval: plan.finish !== 'draft', lines: plan.lines.map(item => ({ ...item })),
    } as never, accountantId);
    if (plan.finish === 'post') {
      await vouchers.approve(created.id, { note: 'Checked' }, managerId);
      await vouchers.post(created.id, accountantId);
    }
  }
  log(`${voucherPlan.length} vouchers (5 posted after approval, 1 waiting for approval, 1 draft)`);

  // ── Cheque book with issued and voided cheques, and a draft bank deposit ──
  const cheques = new BankChequeService(companyId);
  await cheques.createBook({
    bank_account_id: bankAccount.id, book_number: 'DEMO-CB-01', start_cheque_number: '1000001', end_cheque_number: '1000025',
    issued_date: '2026-07-01', received_date: '2026-07-03', notes: 'Demo cheque book',
  } as never, admin.id);
  const available = await cheques.availableCheques({ bank_account_id: bankAccount.id, limit: 3 } as never) as Array<{ id: string }> | { data: Array<{ id: string }> };
  const leaves = Array.isArray(available) ? available : available.data;
  if (leaves[0]) await cheques.issueCheque(leaves[0].id, { issue_date: '2026-09-18', payee_name: suppliers[0].name, payment_reference: 'Supplier payment', amount: 60000 }, admin.id);
  if (leaves[1]) await cheques.voidCheque(leaves[1].id, { reason: 'Writing Mistake', notes: 'Wrong amount written' } as never, admin.id);
  log('Cheque book DEMO-CB-01 (25 leaves, 1 issued, 1 voided)');

  const depositType = await one(prisma.$queryRaw<Array<{ id: string; name: string }>>`
    SELECT id::text, name FROM bank_deposit_types WHERE company_id = CAST(${companyId} AS uuid) AND code = 'CHQ'`, 'a deposit type');
  const deposit = await one(prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO bank_deposits (company_id, bank_account_id, deposit_number, deposit_date, reference_number, description, status, cheque_total, total_amount, created_by_id)
    VALUES (CAST(${companyId} AS uuid), CAST(${bankAccount.id} AS uuid), 'DEMO-DEP-0001', '2026-10-23', ${DEMO_REFERENCE}, 'Customer cheques to deposit (draft)', 'Draft', 18000, 18000, CAST(${admin.id} AS uuid))
    RETURNING id::text`, 'the new deposit');
  await prisma.$executeRaw`
    INSERT INTO bank_deposit_lines (company_id, bank_deposit_id, line_number, received_from_account_id, received_from_account_code, received_from_account_name,
                                    deposit_type_id, deposit_type_name, description, cheque_number, cheque_date, cheque_bank_name, amount)
    VALUES (CAST(${companyId} AS uuid), CAST(${deposit.id} AS uuid), 1, CAST(${customerAccount.id} AS uuid), ${customerAccount.code}, ${customerAccount.name},
            CAST(${depositType.id} AS uuid), ${depositType.name}, 'Customer cheque', 'MCB-445566', '2026-10-22', 'Muslim Commercial Bank', 18000)`;
  log('1 draft Bank Deposit (no ledger effect until posted)');

  console.log('\nDemo data added.');
  if (Object.keys(passwords).length) {
    console.log('Demo user passwords (test environment only):');
    for (const [email, password] of Object.entries(passwords)) console.log(`  ${email}  ${password}`);
  }
}

main()
  .catch(error => {
    console.error('Demo data failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
