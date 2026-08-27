import { afterAll, expect, test } from 'bun:test';
import { createPool } from './client';

const DB_TIMEOUT = 30_000;

const pool = createPool();
const uniq = () => `t${Date.now()}${Math.floor(Math.random() * 1e6)}`;

afterAll(async () => {
  await pool.query(`delete from "user" where email like 't%@constraint.test'`);
  await pool.end();
}, DB_TIMEOUT);

async function insertUser(email: string, accountType: 'brand' | 'creator') {
  const { rows } = await pool.query<{ id: string }>(
    'insert into "user" (id, email, name, account_type) values ($1, $2, $3, $4) returning id',
    [crypto.randomUUID(), email, 'Constraint Test', accountType]
  );
  return rows[0]!.id;
}

async function expectFailure(run: () => Promise<unknown>, pattern: RegExp) {
  let message = '';
  try {
    await run();
  } catch (error) {
    message = (error as Error).message;
  }
  expect(message).toMatch(pattern);
}

test('citext and vector extensions are installed', async () => {
  const { rows } = await pool.query<{ extname: string }>(
    "select extname from pg_extension where extname in ('citext', 'vector')"
  );
  expect(rows.map((r) => r.extname).sort()).toEqual(['citext', 'vector']);
}, DB_TIMEOUT);

test('every expected table exists', async () => {
  const { rows } = await pool.query<{ table_name: string }>(
    "select table_name from information_schema.tables where table_schema = 'public'"
  );
  const names = rows.map((r) => r.table_name);
  for (const t of [
    'user',
    'session',
    'account',
    'verification',
    'workspaces',
    'workspace_members',
    'brands',
    'creators',
    'linkedin_profile_snapshots'
  ]) {
    expect(names).toContain(t);
  }
}, DB_TIMEOUT);

test('email uniqueness ignores case', async () => {
  const email = `${uniq()}@constraint.test`;
  await insertUser(email, 'brand');
  await expectFailure(() => insertUser(email.toUpperCase(), 'brand'), /duplicate key/i);
}, DB_TIMEOUT);

test('account_type cannot be changed after insert', async () => {
  const id = await insertUser(`${uniq()}@constraint.test`, 'creator');
  await expectFailure(
    () => pool.query(`update "user" set account_type = 'brand' where id = $1`, [id]),
    /account_type is immutable/i
  );
}, DB_TIMEOUT);

test('updating other columns still works', async () => {
  const id = await insertUser(`${uniq()}@constraint.test`, 'brand');
  await pool.query(`update "user" set name = $1 where id = $2`, ['Renamed', id]);
  const { rows } = await pool.query<{ name: string }>(`select name from "user" where id = $1`, [id]);
  expect(rows[0]!.name).toBe('Renamed');
}, DB_TIMEOUT);

test('a creator cannot hold more than three topics', async () => {
  const id = await insertUser(`${uniq()}@constraint.test`, 'creator');
  await expectFailure(
    () =>
      pool.query(
        `insert into creators (user_id, profile_url, name, topics, rate_per_post_minor)
         values ($1, $2, $3, $4::sector[], $5)`,
        [id, `https://linkedin.com/in/${uniq()}`, 'Too Many', ['RevOps', 'Sales', 'Design', 'Gaming'], 1000]
      ),
    /creators_topics_len/i
  );
}, DB_TIMEOUT);

test('a creator cannot report more delivered than accepted', async () => {
  const id = await insertUser(`${uniq()}@constraint.test`, 'creator');
  await expectFailure(
    () =>
      pool.query(
        `insert into creators (user_id, profile_url, name, topics, rate_per_post_minor, accepted_count, delivered_count)
         values ($1, $2, $3, $4::sector[], $5, 2, 5)`,
        [id, `https://linkedin.com/in/${uniq()}`, 'Impossible', ['RevOps'], 1000]
      ),
    /creators_delivered_lte_accepted/i
  );
}, DB_TIMEOUT);

test('embedding columns are 768 dimensions and carry an hnsw index', async () => {
  const { rows } = await pool.query<{ indexname: string; indexdef: string }>(
    `select indexname, indexdef from pg_indexes
     where indexname in ('brands_icp_embedding_idx', 'creators_fingerprint_embedding_idx')`
  );
  expect(rows).toHaveLength(2);
  for (const r of rows) expect(r.indexdef).toMatch(/USING hnsw/i);

  const { rows: cols } = await pool.query<{ format_type: string }>(
    `select format_type(a.atttypid, a.atttypmod) as format_type
     from pg_attribute a
     where a.attrelid = 'creators'::regclass and a.attname = 'fingerprint_embedding'`
  );
  expect(cols[0]!.format_type).toBe('vector(768)');
}, DB_TIMEOUT);
