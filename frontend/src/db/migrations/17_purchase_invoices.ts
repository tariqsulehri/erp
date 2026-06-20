import { MigrationInterface, QueryRunner } from 'typeorm';

export class PurchaseInvoices1745000000017 implements MigrationInterface {
  name = 'PurchaseInvoices1745000000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS purchase_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL,
        default_cash_account_id UUID NOT NULL,
        default_inventory_account_id UUID NOT NULL,
        purchase_tax_account_id UUID,
        freight_account_id UUID,
        purchase_discount_account_id UUID,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_purchase_settings_company UNIQUE (company_id),
        CONSTRAINT fk_purchase_settings_company FOREIGN KEY (company_id) REFERENCES companies(id),
        CONSTRAINT fk_purchase_settings_cash_account FOREIGN KEY (default_cash_account_id) REFERENCES accounts(id),
        CONSTRAINT fk_purchase_settings_inventory_account FOREIGN KEY (default_inventory_account_id) REFERENCES accounts(id),
        CONSTRAINT fk_purchase_settings_tax_account FOREIGN KEY (purchase_tax_account_id) REFERENCES accounts(id),
        CONSTRAINT fk_purchase_settings_freight_account FOREIGN KEY (freight_account_id) REFERENCES accounts(id),
        CONSTRAINT fk_purchase_settings_discount_account FOREIGN KEY (purchase_discount_account_id) REFERENCES accounts(id)
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_purchase_settings_active ON purchase_settings(company_id, is_active);`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS purchase_invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL,
        accounting_voucher_id UUID,
        purchase_number VARCHAR(30) NOT NULL,
        purchase_date DATE NOT NULL,
        supplier_id UUID NOT NULL,
        supplier_account_id UUID NOT NULL,
        supplier_invoice_number VARCHAR(100),
        supplier_invoice_date DATE,
        payment_type VARCHAR(20) NOT NULL,
        due_date DATE,
        warehouse_id UUID NOT NULL,
        reference_number VARCHAR(100),
        description TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'Draft',
        gross_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
        discount_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
        tax_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
        freight_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
        net_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
        created_by_id UUID,
        updated_by_id UUID,
        posted_by_id UUID,
        posted_at TIMESTAMPTZ,
        voided_by_id UUID,
        voided_at TIMESTAMPTZ,
        void_reason TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_purchase_invoices_number UNIQUE (company_id, purchase_number),
        CONSTRAINT fk_purchase_invoices_company FOREIGN KEY (company_id) REFERENCES companies(id),
        CONSTRAINT fk_purchase_invoices_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
        CONSTRAINT fk_purchase_invoices_supplier_account FOREIGN KEY (supplier_account_id) REFERENCES accounts(id),
        CONSTRAINT fk_purchase_invoices_warehouse FOREIGN KEY (warehouse_id) REFERENCES inventory_warehouses(id),
        CONSTRAINT fk_purchase_invoices_voucher FOREIGN KEY (accounting_voucher_id) REFERENCES vouchers(id),
        CONSTRAINT chk_purchase_invoices_payment_type CHECK (payment_type IN ('Cash', 'Credit')),
        CONSTRAINT chk_purchase_invoices_status CHECK (status IN ('Draft', 'Posted', 'Voided')),
        CONSTRAINT chk_purchase_invoices_amounts CHECK (
          gross_amount >= 0
          AND discount_amount >= 0
          AND tax_amount >= 0
          AND freight_amount >= 0
          AND net_amount >= 0
        )
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_purchase_invoices_company_date ON purchase_invoices(company_id, purchase_date);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_purchase_invoices_company_status ON purchase_invoices(company_id, status);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_purchase_invoices_supplier ON purchase_invoices(company_id, supplier_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_purchase_invoices_active ON purchase_invoices(company_id, is_active);`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS purchase_invoice_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL,
        purchase_invoice_id UUID NOT NULL,
        line_number INTEGER NOT NULL,
        item_id UUID NOT NULL,
        item_code VARCHAR(60) NOT NULL,
        item_name VARCHAR(250) NOT NULL,
        uom_id UUID,
        uom_name VARCHAR(80),
        warehouse_id UUID NOT NULL,
        quantity NUMERIC(18, 4) NOT NULL,
        purchase_price NUMERIC(18, 4) NOT NULL,
        discount_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
        tax_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
        line_total NUMERIC(18, 2) NOT NULL,
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_purchase_invoice_lines_number UNIQUE (purchase_invoice_id, line_number),
        CONSTRAINT fk_purchase_invoice_lines_invoice FOREIGN KEY (purchase_invoice_id) REFERENCES purchase_invoices(id) ON DELETE CASCADE,
        CONSTRAINT fk_purchase_invoice_lines_item FOREIGN KEY (item_id) REFERENCES inventory_items(id),
        CONSTRAINT fk_purchase_invoice_lines_uom FOREIGN KEY (uom_id) REFERENCES inventory_units_of_measure(id),
        CONSTRAINT fk_purchase_invoice_lines_warehouse FOREIGN KEY (warehouse_id) REFERENCES inventory_warehouses(id),
        CONSTRAINT chk_purchase_invoice_lines_amounts CHECK (
          quantity > 0
          AND purchase_price >= 0
          AND discount_amount >= 0
          AND tax_amount >= 0
          AND line_total > 0
        )
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_purchase_invoice_lines_invoice ON purchase_invoice_lines(company_id, purchase_invoice_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_purchase_invoice_lines_item ON purchase_invoice_lines(company_id, item_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_purchase_invoice_lines_warehouse ON purchase_invoice_lines(company_id, warehouse_id);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_purchase_invoice_lines_warehouse;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_purchase_invoice_lines_item;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_purchase_invoice_lines_invoice;`);
    await queryRunner.query(`DROP TABLE IF EXISTS purchase_invoice_lines;`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_purchase_invoices_active;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_purchase_invoices_supplier;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_purchase_invoices_company_status;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_purchase_invoices_company_date;`);
    await queryRunner.query(`DROP TABLE IF EXISTS purchase_invoices;`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_purchase_settings_active;`);
    await queryRunner.query(`DROP TABLE IF EXISTS purchase_settings;`);
  }
}
