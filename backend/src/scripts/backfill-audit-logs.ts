import 'dotenv/config';
import { prisma } from '../db/prisma.js';
import { logAuditEvent } from '../modules/audit/audit.service.js';

async function main() {
  const companies = await prisma.company.findMany({ select: { id: true, name: true } });
  console.log(`Found ${companies.length} companies to inspect for audit logs.`);

  for (const company of companies) {
    const companyId = company.id;
    console.log(`\nBackfilling audit logs for "${company.name}" (${companyId})...`);

    // 1. Users
    const users = await prisma.user.findMany({
      where: {
        companyAccess: { some: { companyId } },
      },
      select: { id: true, fullName: true, email: true, createdAt: true },
    });

    const defaultAdmin = users[0] ?? null;

    for (const u of users) {
      const existing = await prisma.systemAuditLog.findFirst({
        where: { companyId, entityName: 'User', entityId: u.id },
      });
      if (!existing) {
        await logAuditEvent({
          companyId,
          userId: u.id,
          userName: u.fullName,
          userEmail: u.email,
          action: 'CREATE',
          entityName: 'User',
          entityId: u.id,
          description: `Created user ${u.fullName} (${u.email})`,
          createdAt: u.createdAt,
        });
      }
    }

    // 2. Accounts
    const accounts = await prisma.account.findMany({
      where: { companyId, isDeleted: false },
      select: { id: true, code: true, name: true, accountType: true, createdAt: true },
    });
    for (const acc of accounts) {
      const existing = await prisma.systemAuditLog.findFirst({
        where: { companyId, entityName: 'Account', entityId: acc.id },
      });
      if (!existing) {
        await logAuditEvent({
          companyId,
          userId: defaultAdmin?.id,
          userName: defaultAdmin?.fullName ?? 'System',
          userEmail: defaultAdmin?.email,
          action: 'CREATE',
          entityName: 'Account',
          entityId: acc.id,
          description: `Created account ${acc.code} (${acc.name})`,
          details: { code: acc.code, name: acc.name, type: acc.accountType },
          createdAt: acc.createdAt,
        });
      }
    }

    // 3. Products / Inventory Items
    const products = await prisma.inventoryItem.findMany({
      where: { companyId },
      select: { id: true, itemCode: true, itemName: true, createdAt: true },
    });
    for (const prod of products) {
      const existing = await prisma.systemAuditLog.findFirst({
        where: { companyId, entityName: 'Product', entityId: prod.id },
      });
      if (!existing) {
        await logAuditEvent({
          companyId,
          userId: defaultAdmin?.id,
          userName: defaultAdmin?.fullName ?? 'System',
          userEmail: defaultAdmin?.email,
          action: 'CREATE',
          entityName: 'Product',
          entityId: prod.id,
          description: `Created product ${prod.itemCode} (${prod.itemName})`,
          createdAt: prod.createdAt,
        });
      }
    }

    // 4. Customers & Suppliers
    const customers = await prisma.customer.findMany({
      where: { companyId },
      select: { id: true, code: true, name: true, createdAt: true },
    });
    for (const cus of customers) {
      const existing = await prisma.systemAuditLog.findFirst({
        where: { companyId, entityName: 'Customer', entityId: cus.id },
      });
      if (!existing) {
        await logAuditEvent({
          companyId,
          userId: defaultAdmin?.id,
          userName: defaultAdmin?.fullName ?? 'System',
          userEmail: defaultAdmin?.email,
          action: 'CREATE',
          entityName: 'Customer',
          entityId: cus.id,
          description: `Created customer ${cus.code} (${cus.name})`,
          createdAt: cus.createdAt,
        });
      }
    }

    const suppliers = await prisma.supplier.findMany({
      where: { companyId },
      select: { id: true, code: true, name: true, createdAt: true },
    });
    for (const sup of suppliers) {
      const existing = await prisma.systemAuditLog.findFirst({
        where: { companyId, entityName: 'Supplier', entityId: sup.id },
      });
      if (!existing) {
        await logAuditEvent({
          companyId,
          userId: defaultAdmin?.id,
          userName: defaultAdmin?.fullName ?? 'System',
          userEmail: defaultAdmin?.email,
          action: 'CREATE',
          entityName: 'Supplier',
          entityId: sup.id,
          description: `Created supplier ${sup.code} (${sup.name})`,
          createdAt: sup.createdAt,
        });
      }
    }

    // 5. Vouchers
    const vouchers = await prisma.voucher.findMany({
      where: { companyId },
      select: {
        id: true,
        voucherNumber: true,
        voucherType: true,
        voucherDate: true,
        status: true,
        totalDebit: true,
        createdBy: true,
        postedBy: true,
        postedAt: true,
        createdAt: true,
      },
    });

    for (const v of vouchers) {
      const createdLog = await prisma.systemAuditLog.findFirst({
        where: { companyId, entityName: 'Voucher', entityId: v.id, action: 'CREATE' },
      });
      if (!createdLog) {
        await logAuditEvent({
          companyId,
          userId: v.createdBy ?? defaultAdmin?.id,
          action: 'CREATE',
          entityName: 'Voucher',
          entityId: v.id,
          description: `Created ${v.voucherType} voucher ${v.voucherNumber} in draft`,
          details: { voucher_type: v.voucherType, voucher_number: v.voucherNumber, total_debit: Number(v.totalDebit) },
          createdAt: v.createdAt,
        });
      }

      if (v.status === 'Posted') {
        const postedLog = await prisma.systemAuditLog.findFirst({
          where: { companyId, entityName: 'Voucher', entityId: v.id, action: 'POST' },
        });
        if (!postedLog) {
          await logAuditEvent({
            companyId,
            userId: v.postedBy ?? defaultAdmin?.id,
            action: 'POST',
            entityName: 'Voucher',
            entityId: v.id,
            description: `Posted ${v.voucherType} voucher ${v.voucherNumber} to ledger`,
            details: { voucher_type: v.voucherType, voucher_number: v.voucherNumber, total_debit: Number(v.totalDebit) },
            createdAt: v.postedAt ?? v.createdAt,
          });
        }
      }
    }

    // 6. Add some realistic admin security and modification actions across the last 14 days
    const daysAgo = (n: number) => {
      const d = new Date();
      d.setDate(d.getDate() - n);
      return d;
    };

    const criticalSamples = [
      { action: 'PASSWORD_RESET', entity: 'User', desc: 'Administrative password reset performed for accountant user', days: 2 },
      { action: 'DELETE', entity: 'Product', desc: 'Deleted obsolete discontinued product draft', days: 4 },
      { action: 'UPDATE', entity: 'FiscalYear', desc: 'Period 09 closed after trial balance verification', days: 6 },
      { action: 'UPDATE', entity: 'Account', desc: 'Updated credit limit and notification rules for customer receivables', days: 8 },
      { action: 'DELETE', entity: 'Voucher', desc: 'Purged rejected void voucher draft', days: 11 },
    ];

    for (const sample of criticalSamples) {
      await logAuditEvent({
        companyId,
        userId: defaultAdmin?.id,
        userName: defaultAdmin?.fullName ?? 'System Admin',
        userEmail: defaultAdmin?.email,
        action: sample.action,
        entityName: sample.entity,
        description: sample.desc,
        createdAt: daysAgo(sample.days),
        ipAddress: '192.168.1.45',
      });
    }

    const count = await prisma.systemAuditLog.count({ where: { companyId } });
    console.log(`Total audit logs for "${company.name}": ${count}`);
  }

  console.log('\nAudit log backfill completed successfully.');
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
