import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as path from 'path';

/**
 * Explicit entity imports required for Next.js webpack runtime.
 * Glob patterns do not work in the bundled environment — TypeORM cannot
 * resolve file paths at build time, so every entity must be listed here.
 * When adding a new entity file, import the class and add it to the array.
 */
import { Account } from '@/modules/accounts/account.entity';
import { AccountCategory } from '@/modules/accounts/account.entity';
import { AccountAuditLog } from '@/modules/accounts/account-audit.entity';
import { COATemplate } from '@/modules/accounts/coa-template.entity';
import { FiscalYear, FiscalPeriod } from '@/modules/fiscal-year/fiscal-year.entity';
import { Company, CompanyGroup } from '@/modules/companies/company.entity';
import { Voucher, VoucherLine }   from '@/modules/vouchers/voucher.entity';
import { Product }               from '@/modules/inventory/product.entity';
import { ProductCategory }       from '@/modules/inventory/product-category.entity';
import { UnitOfMeasure }         from '@/modules/inventory/uom.entity';
import { Customer }              from '@/modules/customers/customer.entity';
import { Supplier }              from '@/modules/suppliers/supplier.entity';
import {
  CostCenter,
  Department,
  DocumentApproval,
  DocumentAttachment,
  Project,
} from '@/modules/transactions/transaction-support.entity';

const isProduction = process.env.NODE_ENV === 'production';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USER || 'erp_user',
  password: process.env.DATABASE_PASSWORD || 'erp_password',
  database: process.env.DATABASE_NAME || 'erp_financial_db',
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,

  // Explicit entity list — glob patterns are not supported in the Next.js runtime
  entities: [
    Account, AccountCategory, AccountAuditLog, COATemplate,
    FiscalYear, FiscalPeriod,
    Company, CompanyGroup,
    Voucher, VoucherLine,
    Product, ProductCategory, UnitOfMeasure,
    Customer,
    Supplier,
    CostCenter, Project, Department, DocumentAttachment, DocumentApproval,
  ],

  // Migrations - load all migration files (glob works fine for CLI/tsx)
  migrations: [
    path.join(__dirname, './migrations/*{.ts,.js}'),
  ],

  // Subscribers (empty for now)
  subscribers: [],

  // Logging configuration
  logging: !isProduction ? ['query', 'error', 'warn'] : ['error'],

  // Synchronization (dev only - auto-sync schema)
  synchronize: !isProduction && process.env.DB_SYNC === 'true',

  // Migrations must be run manually in production
  migrationsRun: false,

  // Connection pool settings (for pg driver)
  extra: {
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
});

// Initialize data source
export async function initializeDataSource() {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log('Database connection initialized successfully');
    }
    return AppDataSource;
  } catch (error) {
    console.error('Error during database connection initialization:', error);
    throw error;
  }
}

export default AppDataSource;
