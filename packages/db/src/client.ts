import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

export function connectionString() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  return upgradeDeprecatedSslMode(url);
}

function upgradeDeprecatedSslMode(url: string) {
  const parsed = new URL(url);
  if (parsed.searchParams.get('sslmode') === 'require') {
    parsed.searchParams.set('sslmode', 'verify-full');
  }
  return parsed.toString();
}

export function createPool() {
  return new pg.Pool({ connectionString: connectionString(), max: 10, allowExitOnIdle: true });
}

export function createDb(pool: pg.Pool) {
  return drizzle(pool, { schema });
}

export type Db = ReturnType<typeof createDb>;
