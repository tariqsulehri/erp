import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPurchaseInvoiceVoucherType1745000000018 implements MigrationInterface {
  name = 'AddPurchaseInvoiceVoucherType1745000000018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE vouchers
      DROP CONSTRAINT IF EXISTS vouchers_voucher_type_check;
    `);

    await queryRunner.query(`
      ALTER TABLE vouchers
      ADD CONSTRAINT vouchers_voucher_type_check
      CHECK (
        voucher_type IN (
          'BRV',
          'BPV',
          'CRV',
          'CPV',
          'JV',
          'CV',
          'DN',
          'CN',
          'PI'
        )
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE vouchers
      DROP CONSTRAINT IF EXISTS vouchers_voucher_type_check;
    `);

    await queryRunner.query(`
      ALTER TABLE vouchers
      ADD CONSTRAINT vouchers_voucher_type_check
      CHECK (
        voucher_type IN (
          'BRV',
          'BPV',
          'CRV',
          'CPV',
          'JV',
          'CV',
          'DN',
          'CN'
        )
      );
    `);
  }
}
