import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { buildDatabaseConnectionOptions } from './database-env';

// Load .env.local for CLI usage
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

/** Single DataSource export for TypeORM CLI */
export default new DataSource({
  type: 'postgres',
  ...buildDatabaseConnectionOptions(),

  entities: [
    path.join(process.cwd(), 'src/modules/**/*.entity{.ts,.js}'),
  ],

  migrations: [
    path.join(process.cwd(), 'src/db/migrations/*{.ts,.js}'),
  ],

  synchronize: false,
  logging: ['error', 'warn', 'migration'],
});
