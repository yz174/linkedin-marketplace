import { afterAll, beforeAll, expect, test } from 'bun:test';
import { eq, like } from 'drizzle-orm';
import { users } from '@lm/db';
import { buildApp } from './app';
import { db, pool } from './auth';

const TIMEOUT = 30_000;
const app = buildApp();
const stamp = Date.now();
const email = (tag: string) => `api${stamp}${tag}@constraint.test`;
const PASSWORD = 'correct-horse-battery';

beforeAll(async () => {
  await app.ready();
}, TIMEOUT);

afterAll(async () => {
  await db.delete(users).where(like(users.email, 'api%@constraint.test'));
  await app.close();
  await pool.end();
}, TIMEOUT);

type Injected = Awaited<ReturnType<typeof app.inject>>;

const post = (url: string, body: unknown, headers: Record<string, string> = {}): Promise<Injected> =>
  app.inject({ method: 'POST', url, payload: body as never, headers });

const get = (url: string, headers: Record<string, string> = {}): Promise<Injected> =>
  app.inject({ method: 'GET', url, headers });

function cookieFrom(res: Injected) {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.filter(Boolean).map((c) => String(c).split(';')[0]).join('; ');
}

test('health responds', async () => {
  const res = await get('/health');
  expect(res.statusCode).toBe(200);
  expect(res.json<{ ok: boolean }>()).toEqual({ ok: true });
}, TIMEOUT);

test('a brand can sign up and the row records the account type', async () => {
  const address = email('brand');
  const res = await post('/brand/signup', { email: address, password: PASSWORD, name: 'Brand One' });
  expect(res.statusCode).toBeLessThan(300);

  const [row] = await db.select().from(users).where(eq(users.email, address)).limit(1);
  expect(row?.accountType).toBe('brand');
}, TIMEOUT);

test('a creator email is rejected at brand signup with 409', async () => {
  const address = email('creator');
  const created = await post('/creator/signup', { email: address, password: PASSWORD, name: 'Creator One' });
  expect(created.statusCode).toBeLessThan(300);

  const res = await post('/brand/signup', { email: address, password: PASSWORD, name: 'Impostor' });
  expect(res.statusCode).toBe(409);
  expect(res.json().code).toBe('email_belongs_to_other_account_type');
  expect(res.json().message).toContain('/creator/login');
}, TIMEOUT);

test('a creator email is rejected at brand login with 409', async () => {
  const address = email('login');
  await post('/creator/signup', { email: address, password: PASSWORD, name: 'Creator Two' });

  const res = await post('/brand/login', { email: address, password: PASSWORD });
  expect(res.statusCode).toBe(409);
  expect(res.json().code).toBe('email_belongs_to_other_account_type');
}, TIMEOUT);

test('the same email cannot sign up twice on its own side', async () => {
  const address = email('dupe');
  await post('/brand/signup', { email: address, password: PASSWORD, name: 'Brand Two' });

  const res = await post('/brand/signup', { email: address, password: PASSWORD, name: 'Brand Two' });
  expect(res.statusCode).toBe(409);
  expect(res.json().code).toBe('email_taken');
}, TIMEOUT);

test('a wrong password returns 401 with a stable code', async () => {
  const address = email('wrongpw');
  await post('/brand/signup', { email: address, password: PASSWORD, name: 'Brand Three' });

  const res = await post('/brand/login', { email: address, password: 'not-the-password' });
  expect(res.statusCode).toBe(401);
  expect(res.json().code).toBe('invalid_credentials');
}, TIMEOUT);

test('a signed-in brand reaches a guarded brand route', async () => {
  const address = email('guard');
  const signup = await post('/brand/signup', { email: address, password: PASSWORD, name: 'Brand Four' });
  const cookie = cookieFrom(signup);
  expect(cookie).not.toBe('');

  const res = await get('/brand/me', { cookie });
  expect(res.statusCode).toBe(200);
  expect(res.json().accountType).toBe('brand');
}, TIMEOUT);

test('a creator session is refused on a brand route with 403', async () => {
  const address = email('cross');
  const signup = await post('/creator/signup', { email: address, password: PASSWORD, name: 'Creator Three' });
  const cookie = cookieFrom(signup);

  const res = await get('/brand/me', { cookie });
  expect(res.statusCode).toBe(403);
  expect(res.json().code).toBe('wrong_account_type');
}, TIMEOUT);

test('an unauthenticated request to a guarded route returns 401', async () => {
  const res = await get('/creator/me');
  expect(res.statusCode).toBe(401);
  expect(res.json().code).toBe('not_authenticated');
}, TIMEOUT);

test('a short password is rejected before it reaches the database', async () => {
  const res = await post('/brand/signup', { email: email('short'), password: 'tooshort', name: 'X' });
  expect(res.statusCode).toBe(400);
  expect(res.json().code).toBe('validation_failed');
}, TIMEOUT);
