import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 5 — Refine voucher types
 *
 * Old generic types (PV, RV) are replaced with explicit Bank/Cash variants:
 *   PV → migrated to CPV (Cash Payment Voucher) by default
 *   RV → migrated to CRV (Cash Receipt Voucher) by default
 *
 * New type set: BRV | BPV | CRV | CPV | JV | CV | DN | CN
 */
export class UpdateVoucherTypes1745000000005 implements MigrationInterface {
  name = 'UpdateVoucherTypes1745000000005';

  public async up(runner: QueryRunner): Promise<void> {
    // Rename any legacy PV → CPV and RV → CRV
    await runner.query(`
      UPDATE vouchers SET voucher_type = 'CPV' WHERE voucher_type = 'PV';
    `);
    await runner.query(`
      UPDATE vouchers SET voucher_type = 'CRV' WHERE voucher_type = 'RV';
    `);

    // Drop the old check constraint (PostgreSQL)
    await runner.query(`
      ALTER TABLE vouchers
        DROP CONSTRAINT IF EXISTS vouchers_voucher_type_check;
    `);

    // Add new check constraint with expanded type set
    await runner.query(`
      ALTER TABLE vouchers
        ADD CONSTRAINT vouchers_voucher_type_check
          CHECK (voucher_type IN ('BRV','BPV','CRV','CPV','JV','CV','DN','CN'));
    `);
  }

  public async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      ALTER TABLE vouchers
        DROP CONSTRAINT IF EXISTS vouchers_voucher_type_check;
    `);
    // Revert CPV → PV, CRV → RV
    await runner.query(`
      UPDATE vouchers SET voucher_type = 'PV' WHERE voucher_type = 'CPV';
    `);
    await runner.query(`
      UPDATE vouchers SET voucher_type = 'RV' WHERE voucher_type = 'CRV';
    `);
    await runner.query(`
      ALTER TABLE vouchers
        ADD CONSTRAINT vouchers_voucher_type_check
          CHECK (voucher_type IN ('PV','RV','JV','CV','DN','CN'));
    `);
  }
}
