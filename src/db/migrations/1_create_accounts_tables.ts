import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateAccountsTables1000000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create account_categories table
    await queryRunner.createTable(
      new Table({
        name: 'account_categories',
        columns: [
          {
            name: 'category_code',
            type: 'varchar',
            length: '1',
            isPrimary: true,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'normal_balance',
            type: 'varchar',
            length: '10',
            isNullable: false,
            default: "'Debit'",
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'sort_order',
            type: 'integer',
            default: 0,
          },
        ],
      }),
      true,
    );

    // Create accounts table
    await queryRunner.createTable(
      new Table({
        name: 'accounts',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'company_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'code',
            type: 'varchar',
            length: '8',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'account_type',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'normal_balance',
            type: 'varchar',
            length: '10',
            isNullable: false,
          },
          {
            name: 'is_posting',
            type: 'boolean',
            default: false,
          },
          {
            name: 'is_system',
            type: 'boolean',
            default: false,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'sort_order',
            type: 'integer',
            isNullable: true,
            default: 0,
          },
          {
            name: 'category_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'tax_codes',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'attributes',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'created_by_user_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'updated_by_user_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'audit_metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'is_deleted',
            type: 'boolean',
            default: false,
          },
          {
            name: 'deleted_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'deleted_by_user_id',
            type: 'uuid',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create indexes on accounts table
    await queryRunner.createIndex(
      'accounts',
      new TableIndex({
        name: 'idx_accounts_company_code',
        columnNames: ['company_id', 'code'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'accounts',
      new TableIndex({
        name: 'idx_accounts_company_posting',
        columnNames: ['company_id', 'is_posting', 'is_deleted'],
      }),
    );

    await queryRunner.createIndex(
      'accounts',
      new TableIndex({
        name: 'idx_accounts_company_active',
        columnNames: ['company_id', 'is_active', 'is_deleted'],
      }),
    );

    await queryRunner.createIndex(
      'accounts',
      new TableIndex({
        name: 'idx_accounts_code',
        columnNames: ['code'],
      }),
    );

    // Create coa_templates table
    await queryRunner.createTable(
      new Table({
        name: 'coa_templates',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'template_code',
            type: 'varchar',
            length: '50',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'template_name',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'accounts',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'account_count',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'coa_templates',
      new TableIndex({
        name: 'idx_coa_templates_code',
        columnNames: ['template_code'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('coa_templates', 'idx_coa_templates_code');
    await queryRunner.dropTable('coa_templates');

    await queryRunner.dropIndex('accounts', 'idx_accounts_code');
    await queryRunner.dropIndex('accounts', 'idx_accounts_company_active');
    await queryRunner.dropIndex('accounts', 'idx_accounts_company_posting');
    await queryRunner.dropIndex('accounts', 'idx_accounts_company_code');
    await queryRunner.dropTable('accounts');

    await queryRunner.dropTable('account_categories');
  }
}
