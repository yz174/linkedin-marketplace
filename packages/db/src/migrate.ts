import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb, createPool } from './client';

const here = dirname(fileURLToPath(import.meta.url));

async function runSqlFile(pool: ReturnType<typeof createPool>, name: string) {
  const sql = await readFile(join(here, 'sql', name), 'utf8');
  await pool.query(sql);
}

const pool = createPool();

try {
  await runSqlFile(pool, 'extensions.sql');
  await migrate(createDb(pool), { migrationsFolder: join(here, '..', 'migrations') });
  await runSqlFile(pool, 'guards.sql');
  console.log('migrated');
} finally {
  await pool.end();
}
