import { MigrationInterface, QueryRunner } from 'typeorm';

export class TransactionSupportFields1745000000010 implements MigrationInterface {
  name = 'TransactionSupportFields1745000000010';

  public async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE cost_centers (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id  UUID NOT NULL,
        code        VARCHAR(30) NOT NULL,
        name        VARCHAR(150) NOT NULL,
        description TEXT,
        is_active   BOOLEAN NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_cost_centers_code UNIQUE (company_id, code)
      );
    `);
    await runner.query(`CREATE INDEX idx_cost_centers_active ON cost_centers(company_id, is_active);`);

    await runner.query(`
      CREATE TABLE projects (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id  UUID NOT NULL,
        code        VARCHAR(30) NOT NULL,
        name        VARCHAR(150) NOT NULL,
        description TEXT,
        start_date  DATE,
        end_date    DATE,
        is_active   BOOLEAN NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_projects_code UNIQUE (company_id, code)
      );
    `);
    await runner.query(`CREATE INDEX idx_projects_active ON projects(company_id, is_active);`);

    await runner.query(`
      CREATE TABLE departments (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id  UUID NOT NULL,
        code        VARCHAR(30) NOT NULL,
        name        VARCHAR(150) NOT NULL,
        description TEXT,
        is_active   BOOLEAN NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_departments_code UNIQUE (company_id, code)
      );
    `);
    await runner.query(`CREATE INDEX idx_departments_active ON departments(company_id, is_active);`);

    await runner.query(`
      CREATE TABLE document_attachments (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id     UUID NOT NULL,
        document_type  VARCHAR(50) NOT NULL,
        document_id    UUID NOT NULL,
        file_name      VARCHAR(255) NOT NULL,
        file_url       VARCHAR(500) NOT NULL,
        file_type      VARCHAR(100),
        file_size      BIGINT,
        uploaded_by_id UUID,
        uploaded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await runner.query(`CREATE INDEX idx_document_attachments_doc ON document_attachments(company_id, document_type, document_id);`);

    await runner.query(`
      CREATE TABLE document_approvals (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id      UUID NOT NULL,
        document_type   VARCHAR(50) NOT NULL,
        document_id     UUID NOT NULL,
        approval_status VARCHAR(30) NOT NULL,
        approved_by_id  UUID,
        approved_at     TIMESTAMPTZ,
        remarks         TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await runner.query(`CREATE INDEX idx_document_approvals_doc ON document_approvals(company_id, document_type, document_id);`);

    await runner.query(`
      ALTER TABLE vouchers
        ADD COLUMN approval_status VARCHAR(30) NOT NULL DEFAULT 'Not Required',
        ADD COLUMN approved_by UUID,
        ADD COLUMN approved_at TIMESTAMPTZ,
        ADD COLUMN auto_reverse_date DATE,
        ADD COLUMN reversal_status VARCHAR(30) NOT NULL DEFAULT 'None',
        ADD COLUMN reversal_voucher_id UUID,
        ADD COLUMN reversal_of_id UUID;
    `);
    await runner.query(`CREATE INDEX idx_vouchers_approval_status ON vouchers(company_id, approval_status);`);
    await runner.query(`CREATE INDEX idx_vouchers_reversal_of ON vouchers(reversal_of_id) WHERE reversal_of_id IS NOT NULL;`);

    await runner.query(`
      ALTER TABLE voucher_lines
        ADD COLUMN cost_center_id UUID,
        ADD COLUMN project_id UUID,
        ADD COLUMN department_id UUID;
    `);
    await runner.query(`CREATE INDEX idx_voucher_lines_cost_center ON voucher_lines(cost_center_id) WHERE cost_center_id IS NOT NULL;`);
    await runner.query(`CREATE INDEX idx_voucher_lines_project ON voucher_lines(project_id) WHERE project_id IS NOT NULL;`);
    await runner.query(`CREATE INDEX idx_voucher_lines_department ON voucher_lines(department_id) WHERE department_id IS NOT NULL;`);

    await runner.query(`
      CREATE TRIGGER cost_centers_updated_at
        BEFORE UPDATE ON cost_centers
        FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
    `);
    await runner.query(`
      CREATE TRIGGER projects_updated_at
        BEFORE UPDATE ON projects
        FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
    `);
    await runner.query(`
      CREATE TRIGGER departments_updated_at
        BEFORE UPDATE ON departments
        FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
    `);
  }

  public async down(runner: QueryRunner): Promise<void> {
    await runner.query(`DROP TRIGGER IF EXISTS departments_updated_at ON departments;`);
    await runner.query(`DROP TRIGGER IF EXISTS projects_updated_at ON projects;`);
    await runner.query(`DROP TRIGGER IF EXISTS cost_centers_updated_at ON cost_centers;`);

    await runner.query(`DROP INDEX IF EXISTS idx_voucher_lines_department;`);
    await runner.query(`DROP INDEX IF EXISTS idx_voucher_lines_project;`);
    await runner.query(`DROP INDEX IF EXISTS idx_voucher_lines_cost_center;`);
    await runner.query(`
      ALTER TABLE voucher_lines
        DROP COLUMN IF EXISTS department_id,
        DROP COLUMN IF EXISTS project_id,
        DROP COLUMN IF EXISTS cost_center_id;
    `);

    await runner.query(`DROP INDEX IF EXISTS idx_vouchers_reversal_of;`);
    await runner.query(`DROP INDEX IF EXISTS idx_vouchers_approval_status;`);
    await runner.query(`
      ALTER TABLE vouchers
        DROP COLUMN IF EXISTS reversal_of_id,
        DROP COLUMN IF EXISTS reversal_voucher_id,
        DROP COLUMN IF EXISTS reversal_status,
        DROP COLUMN IF EXISTS auto_reverse_date,
        DROP COLUMN IF EXISTS approved_at,
        DROP COLUMN IF EXISTS approved_by,
        DROP COLUMN IF EXISTS approval_status;
    `);

    await runner.query(`DROP TABLE IF EXISTS document_approvals;`);
    await runner.query(`DROP TABLE IF EXISTS document_attachments;`);
    await runner.query(`DROP TABLE IF EXISTS departments;`);
    await runner.query(`DROP TABLE IF EXISTS projects;`);
    await runner.query(`DROP TABLE IF EXISTS cost_centers;`);
  }
}
