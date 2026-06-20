type DatabaseSslOption = false | { rejectUnauthorized: false };

export type DatabaseConnectionOptions =
  | {
      url: string;
      ssl: DatabaseSslOption;
    }
  | {
      host: string;
      port: number;
      username: string;
      password: string;
      database: string;
      ssl: DatabaseSslOption;
    };

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function readRequiredEnv(name: string) {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`${name} is required for the database connection.`);
  }
  return value;
}

function readDatabaseSsl(): DatabaseSslOption {
  return readEnv('DATABASE_SSL') === 'true' ? { rejectUnauthorized: false } : false;
}

export function buildDatabaseConnectionOptions(): DatabaseConnectionOptions {
  const ssl = readDatabaseSsl();
  const databaseUrl = readEnv('DATABASE_URL');

  if (databaseUrl) {
    return { url: databaseUrl, ssl };
  }

  const portText = readEnv('DATABASE_PORT') ?? '5432';
  const port = Number.parseInt(portText, 10);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('DATABASE_PORT must be a valid positive number.');
  }

  return {
    host: readRequiredEnv('DATABASE_HOST'),
    port,
    username: readRequiredEnv('DATABASE_USER'),
    password: process.env.DATABASE_PASSWORD ?? '',
    database: readRequiredEnv('DATABASE_NAME'),
    ssl,
  };
}
