import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 11 — Party roles for Customer and Supplier masters.
 *
 * Adds simple role fields so one customer/supplier record can be marked as
 * "Customer And Supplier" while keeping one linked GL account for now.
 */
export class PartyRolesForCustomersSuppliers1745000000011 implements MigrationInterface {
  name = 'PartyRolesForCustomersSuppliers1745000000011';

  public async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      ALTER TABLE customers
        ADD COLUMN IF NOT EXISTS party_type VARCHAR(30) NOT NULL DEFAULT 'Customer',
        ADD COLUMN IF NOT EXISTS main_role VARCHAR(20) NOT NULL DEFAULT 'Customer';
    `);

    await runner.query(`
      ALTER TABLE suppliers
        ADD COLUMN IF NOT EXISTS party_type VARCHAR(30) NOT NULL DEFAULT 'Supplier',
        ADD COLUMN IF NOT EXISTS main_role VARCHAR(20) NOT NULL DEFAULT 'Supplier';
    `);

    await runner.query(`
      UPDATE customers
         SET party_type = COALESCE(NULLIF(party_type, ''), 'Customer'),
             main_role = 'Customer'
       WHERE party_type IS NULL
          OR main_role IS NULL
          OR main_role <> 'Customer';
    `);

    await runner.query(`
      UPDATE suppliers
         SET party_type = COALESCE(NULLIF(party_type, ''), 'Supplier'),
             main_role = 'Supplier'
       WHERE party_type IS NULL
          OR main_role IS NULL
          OR main_role <> 'Supplier';
    `);

    await runner.query(`
      ALTER TABLE customers
        DROP CONSTRAINT IF EXISTS chk_customers_party_type,
        DROP CONSTRAINT IF EXISTS chk_customers_main_role;
    `);
    await runner.query(`
      ALTER TABLE customers
        ADD CONSTRAINT chk_customers_party_type
          CHECK (party_type IN ('Customer', 'Customer And Supplier')),
        ADD CONSTRAINT chk_customers_main_role
          CHECK (main_role = 'Customer');
    `);

    await runner.query(`
      ALTER TABLE suppliers
        DROP CONSTRAINT IF EXISTS chk_suppliers_party_type,
        DROP CONSTRAINT IF EXISTS chk_suppliers_main_role;
    `);
    await runner.query(`
      ALTER TABLE suppliers
        ADD CONSTRAINT chk_suppliers_party_type
          CHECK (party_type IN ('Supplier', 'Customer And Supplier')),
        ADD CONSTRAINT chk_suppliers_main_role
          CHECK (main_role = 'Supplier');
    `);

    await runner.query(`CREATE INDEX IF NOT EXISTS idx_customers_party_type ON customers(company_id, party_type);`);
    await runner.query(`CREATE INDEX IF NOT EXISTS idx_suppliers_party_type ON suppliers(company_id, party_type);`);
  }

  public async down(runner: QueryRunner): Promise<void> {
    await runner.query(`DROP INDEX IF EXISTS idx_suppliers_party_type;`);
    await runner.query(`DROP INDEX IF EXISTS idx_customers_party_type;`);
    await runner.query(`ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS chk_suppliers_main_role;`);
    await runner.query(`ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS chk_suppliers_party_type;`);
    await runner.query(`ALTER TABLE customers DROP CONSTRAINT IF EXISTS chk_customers_main_role;`);
    await runner.query(`ALTER TABLE customers DROP CONSTRAINT IF EXISTS chk_customers_party_type;`);
    await runner.query(`ALTER TABLE suppliers DROP COLUMN IF EXISTS main_role;`);
    await runner.query(`ALTER TABLE suppliers DROP COLUMN IF EXISTS party_type;`);
    await runner.query(`ALTER TABLE customers DROP COLUMN IF EXISTS main_role;`);
    await runner.query(`ALTER TABLE customers DROP COLUMN IF EXISTS party_type;`);
  }
}
