import { afterAll, beforeAll, expect, test } from 'bun:test';
import type { BrandWallet } from '@lm/contracts';
import { collaborations, creators, users } from '@lm/db';
import { eq, like } from 'drizzle-orm';
import { buildApp } from '../app';
import { db } from '../auth';

const TIMEOUT = 60_000;
const app = buildApp();
const stamp = Date.now();
const PASSWORD = 'correct-horse-battery';

let brandCookie = '';
let creatorCookie = '';
let creatorId = '';

type Injected = Awaited<ReturnType<typeof app.inject>>;

const post = (url: string, body: unknown, cookie = '', key?: string): Promise<Injected> =>
  app.inject({
    method: 'POST',
    url,
    payload: body as never,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(key ? { 'idempotency-key': key } : {})
    }
  });

const get = (url: string, cookie: string) => app.inject({ method: 'GET', url, headers: { cookie } });

function cookieFrom(res: Injected) {
  const raw = res.headers['set-cookie'];
  return (Array.isArray(raw) ? raw : [raw])
    .filter(Boolean)
    .map((c) => String(c).split(';')[0])
    .join('; ');
}

async function invite(title: string, feeMinor: number) {
  const campaign = await post(
    '/brand/campaigns',
    {
      title,
      objective: 'Explain why a long interview loop costs more than a bad hire does.',
      deliverable: 'One post.',
      budgetMinMinor: 10_000,
      budgetMaxMinor: 90_000,
      source: 'ai'
    },
    brandCookie
  );

  const created = await post(
    '/brand/collaborations',
    { campaignId: campaign.json<{ id: string }>().id, creatorId, feeMinor },
    brandCookie
  );
  expect(created.statusCode).toBe(200);
  return created.json<{ id: string }>().id;
}

beforeAll(async () => {
  brandCookie = cookieFrom(
    await post('/brand/signup', {
      email: `wal${stamp}b@constraint.test`,
      password: PASSWORD,
      name: 'Wallet Brand'
    })
  );
  await post(
    '/brand/profile',
    {
      companyName: 'Walletworks',
      productUrl: 'https://walletworks.example.com',
      icp: {
        summary: 'Walletworks sells interview scheduling to talent teams.',
        points: ['Companies of 50 to 500 people.', 'Talent leads.', 'Structured interviews.'],
        buyerTitles: ['Head of Talent'],
        sectors: ['HR Tech']
      }
    },
    brandCookie
  );

  creatorCookie = cookieFrom(
    await post('/creator/signup', {
      email: `wal${stamp}c@constraint.test`,
      password: PASSWORD,
      name: 'Wallet Creator'
    })
  );

  const [creatorUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, `wal${stamp}c@constraint.test`))
    .limit(1);

  const [creator] = await db
    .insert(creators)
    .values({
      userId: creatorUser!.id,
      profileUrl: `https://www.linkedin.com/in/wal${stamp}`,
      name: 'Wallet Creator',
      topics: ['HR Tech'],
      ratePerPostMinor: 30_000
    })
    .returning();
  creatorId = creator!.id;
}, TIMEOUT);

afterAll(async () => {
  await app.close();
  await db.delete(users).where(like(users.email, 'wal%@constraint.test'));
}, TIMEOUT);

test('a top-up without an Idempotency-Key is refused', async () => {
  const response = await post('/brand/wallet/topup', { amountMinor: 50_000 }, brandCookie);
  expect(response.statusCode).toBe(400);
  expect(response.json<{ message: string }>().message).toContain('Idempotency-Key');
}, TIMEOUT);

test('a repeated top-up with the same key moves money once', async () => {
  const key = `top-${stamp}`;
  const first = await post('/brand/wallet/topup', { amountMinor: 50_000 }, brandCookie, key);
  const second = await post('/brand/wallet/topup', { amountMinor: 50_000 }, brandCookie, key);

  expect(first.statusCode).toBe(200);
  expect(second.statusCode).toBe(200);
  expect(first.json<BrandWallet>().balanceMinor).toBe(50_000);
  expect(second.json<BrandWallet>().balanceMinor).toBe(50_000);

  const wallet = await get('/brand/wallet', brandCookie);
  expect(wallet.json<BrandWallet>().balanceMinor).toBe(50_000);
}, TIMEOUT);

test('reusing a key for a different amount is refused', async () => {
  const key = `top-${stamp}`;
  const response = await post('/brand/wallet/topup', { amountMinor: 70_000 }, brandCookie, key);
  expect(response.statusCode).toBe(409);
}, TIMEOUT);

test('an accept a brand cannot fund is refused and changes nothing', async () => {
  const id = await invite('Wallet over budget', 80_000);

  const accepted = await post(
    `/creator/collaborations/${id}/move`,
    { event: 'accept' },
    creatorCookie
  );

  expect(accepted.statusCode).toBe(402);
  expect(accepted.json<{ code: string }>().code).toBe('insufficient_funds');

  const [row] = await db.select().from(collaborations).where(eq(collaborations.id, id)).limit(1);
  expect(row!.state).toBe('invited');

  const wallet = await get('/brand/wallet', brandCookie);
  expect(wallet.json<BrandWallet>().balanceMinor).toBe(50_000);
  expect(wallet.json<BrandWallet>().heldMinor).toBe(0);
}, TIMEOUT);

test('an accept the brand can fund holds the fee out of the balance', async () => {
  const id = await invite('Wallet in budget', 30_000);

  const accepted = await post(
    `/creator/collaborations/${id}/move`,
    { event: 'accept' },
    creatorCookie
  );
  expect(accepted.statusCode).toBe(200);

  const wallet = await get('/brand/wallet', brandCookie);
  expect(wallet.json<BrandWallet>().balanceMinor).toBe(20_000);
  expect(wallet.json<BrandWallet>().heldMinor).toBe(30_000);
}, TIMEOUT);

test('a cancel returns the held fee to the brand', async () => {
  const id = await invite('Wallet cancelled', 10_000);
  await post(`/creator/collaborations/${id}/move`, { event: 'accept' }, creatorCookie);

  const before = await get('/brand/wallet', brandCookie);
  expect(before.json<BrandWallet>().heldMinor).toBe(40_000);

  await post(`/brand/collaborations/${id}/move`, { event: 'cancel' }, brandCookie);

  const after = await get('/brand/wallet', brandCookie);
  expect(after.json<BrandWallet>().heldMinor).toBe(30_000);
  expect(after.json<BrandWallet>().balanceMinor).toBe(20_000);
}, TIMEOUT);

test('a creator cannot withdraw money they have not earned', async () => {
  const response = await post(
    '/creator/wallet/withdraw',
    { amountMinor: 1_000 },
    creatorCookie,
    `wd-${stamp}`
  );

  expect(response.statusCode).toBe(402);
  expect(response.json<{ code: string }>().code).toBe('insufficient_funds');
}, TIMEOUT);

test('the brand ledger shows every movement, newest first', async () => {
  const wallet = await get('/brand/wallet', brandCookie);
  const kinds = wallet.json<BrandWallet>().entries.map((entry) => entry.kind);

  expect(kinds).toContain('topup');
  expect(kinds).toContain('hold');
  expect(kinds).toContain('refund');
}, TIMEOUT);
