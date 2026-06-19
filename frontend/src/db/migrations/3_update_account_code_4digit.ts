import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Switch account code from 8-digit to 4-digit hierarchy.
 *
 * New pattern (all codes are exactly 4 digits):
 *   X000  →  Category        (divisible by 1000)  e.g. 1000 Assets
 *   XX00  →  Group           (divisible by 100)   e.g. 1100 Current Assets
 *   XXX0  →  Sub-Group       (divisible by 10)    e.g. 1110 Cash & Equivalents
 *   XXXX  →  Posting Account (no trailing zero)   e.g. 1111 Cash in Hand
 */
export class UpdateAccountCode4Digit1000000000002 implements MigrationInterface {
  name = 'UpdateAccountCode4Digit1000000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Truncate accounts — the 8-digit import templates are being replaced
    await queryRunner.query(`TRUNCATE TABLE "accounts" RESTART IDENTITY CASCADE`);

    // Widen the code column from 8 to 4 characters
    // (varchar(4) enforces the max length at the DB level)
    await queryRunner.query(
      `ALTER TABLE "accounts" ALTER COLUMN "code" TYPE character varying(4)`,
    );

    // Add DB-level check constraint for exactly 4 digits
    await queryRunner.query(
      `ALTER TABLE "accounts" ADD CONSTRAINT "CHK_accounts_code_4digit" CHECK ("code" ~ '^[0-9]{4}$')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "CHK_accounts_code_4digit"`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts" ALTER COLUMN "code" TYPE character varying(8)`,
    );
  }
}
