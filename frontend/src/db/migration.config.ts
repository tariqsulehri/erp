import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load .env.local for CLI usage
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

/** Single DataSource export for TypeORM CLI */
export default new DataSource({
  type: 'postgres',
  host:     process.env.DATABASE_HOST     || 'localhost',
  port:     parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USER     || 'devops',
  password: process.env.DATABASE_PASSWORD || 'devops_secure_pwd',
  database: process.env.DATABASE_NAME     || 'erp_financial_db',
  ssl: false,

  entities: [
    path.join(process.cwd(), 'src/modules/**/*.entity{.ts,.js}'),
  ],

  migrations: [
    path.join(process.cwd(), 'src/db/migrations/*{.ts,.js}'),
  ],

  synchronize: false,
  logging: ['error', 'warn', 'migration'],
});
