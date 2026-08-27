import { afterAll, beforeAll, expect, test } from 'bun:test';
import type { CollabChanged, CreatorWallet } from '@lm/contracts';
import { collaborations, creators, users } from '@lm/db';
import { eq, like } from 'drizzle-orm';
import { buildApp } from '../app';
import { db } from '../auth';
import { InProcessBroker } from '../messaging/broker';
import { creatorRoom } from './bus';
import { SETTLE_WINDOW_MS, sweepSettlement, VERIFY_WINDOW_MS } from './expiry';

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

const rowOf = async (id: string) => {
  const [row] = await db.select().from(collaborations).where(eq(collaborations.id, id)).limit(1);
  return row!;
};

async function published(title: string, feeMinor: number) {
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
  const id = created.json<{ id: string }>().id;

  const creatorMove = (body: unknown) =>
    post(`/creator/collaborations/${id}/move`, body, creatorCookie);
  const brandMove = (body: unknown) => post(`/brand/collaborations/${id}/move`, body, brandCookie);

  expect((await creatorMove({ event: 'accept' })).statusCode).toBe(200);
  expect((await brandMove({ event: 'share_brief' })).statusCode).toBe(200);
  expect((await creatorMove({ event: 'submit_draft', draft: 'A draft post.' })).statusCode).toBe(200);
  expect((await brandMove({ event: 'approve' })).statusCode).toBe(200);
  expect((await creatorMove({ event: 'schedule' })).statusCode).toBe(200);
  expect(
    (await creatorMove({ event: 'publish', postUrl: `https://linkedin.test/p/${id}` })).statusCode
  ).toBe(200);

  return id;
}

beforeAll(async () => {
  brandCookie = cookieFrom(
    await post('/brand/signup', {
      email: `set${stamp}b@constraint.test`,
      password: PASSWORD,
      name: 'Settle Brand'
    })
  );
  await post(
    '/brand/profile',
    {
      companyName: 'Settleworks',
      productUrl: 'https://settleworks.example.com',
      icp: {
        summary: 'Settleworks sells interview scheduling to talent teams.',
        points: ['Companies of 50 to 500 people.', 'Talent leads.', 'Structured interviews.'],
        buyerTitles: ['Head of Talent'],
        sectors: ['HR Tech']
      }
    },
    brandCookie
  );
  await post('/brand/wallet/topup', { amountMinor: 500_000 }, brandCookie, `set-fund-${stamp}`);

  creatorCookie = cookieFrom(
    await post('/creator/signup', {
      email: `set${stamp}c@constraint.test`,
      password: PASSWORD,
      name: 'Settle Creator'
    })
  );

  const [creatorUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, `set${stamp}c@constraint.test`))
    .limit(1);

  const [creator] = await db
    .insert(creators)
    .values({
      userId: creatorUser!.id,
      profileUrl: `https://www.linkedin.com/in/set${stamp}`,
      name: 'Settle Creator',
      topics: ['HR Tech'],
      ratePerPostMinor: 30_000
    })
    .returning();
  creatorId = creator!.id;
}, TIMEOUT);

afterAll(async () => {
  await app.close();
  await db.delete(users).where(like(users.email, 'set%@constraint.test'));
}, TIMEOUT);

test('a brand verifies its own published post and delivery is counted', async () => {
  const id = await published('Settle brand verify', 30_000);

  const verified = await post(`/brand/collaborations/${id}/move`, { event: 'verify' }, brandCookie);
  expect(verified.statusCode).toBe(200);

  const row = await rowOf(id);
  expect(row.state).toBe('verified');
  expect(row.verifiedAt).not.toBeNull();

  const [creator] = await db.select().from(creators).where(eq(creators.id, creatorId)).limit(1);
  expect(creator!.deliveredCount).toBeGreaterThan(0);
}, TIMEOUT);

test('a verified collaboration pays the creator once the settlement window passes', async () => {
  const id = await published('Settle auto pay', 40_000);
  await post(`/brand/collaborations/${id}/move`, { event: 'verify' }, brandCookie);

  await db
    .update(collaborations)
    .set({ verifiedAt: new Date(Date.now() - SETTLE_WINDOW_MS - 60_000) })
    .where(eq(collaborations.id, id));

  const bus = new InProcessBroker<CollabChanged>();
  const frames: CollabChanged[] = [];
  bus.subscribe(creatorRoom(creatorId), (frame) => frames.push(frame));

  const settled = await sweepSettlement(bus);
  const mine = settled.find((entry) => entry.collaborationId === id);

  expect(mine).toBeDefined();
  expect(mine!.event).toBe('pay');
  expect(mine!.amountMinor).toBe(40_000);
  expect((await rowOf(id)).state).toBe('paid');

  const wallet = await get('/creator/wallet', creatorCookie);
  expect(wallet.json<CreatorWallet>().balanceMinor).toBe(40_000);
  expect(frames.find((frame) => frame.collaborationId === id)!.to).toBe('paid');
}, TIMEOUT);

test('a published post nobody verified is verified by the system after the window', async () => {
  const id = await published('Settle auto verify', 20_000);

  await db
    .update(collaborations)
    .set({ publishedAt: new Date(Date.now() - VERIFY_WINDOW_MS - 60_000) })
    .where(eq(collaborations.id, id));

  const settled = await sweepSettlement(new InProcessBroker<CollabChanged>());
  const mine = settled.find((entry) => entry.collaborationId === id);

  expect(mine).toBeDefined();
  expect(mine!.event).toBe('verify');
  expect(mine!.amountMinor).toBeNull();
  expect((await rowOf(id)).state).toBe('verified');
}, TIMEOUT);

test('a fresh publication and a fresh verification are both left alone', async () => {
  const id = await published('Settle fresh', 10_000);
  await post(`/brand/collaborations/${id}/move`, { event: 'verify' }, brandCookie);

  const settled = await sweepSettlement(new InProcessBroker<CollabChanged>());
  expect(settled.map((entry) => entry.collaborationId)).not.toContain(id);
  expect((await rowOf(id)).state).toBe('verified');
}, TIMEOUT);

test('a second settlement sweep pays nothing twice', async () => {
  const id = await published('Settle idempotent', 15_000);
  await post(`/brand/collaborations/${id}/move`, { event: 'verify' }, brandCookie);
  await db
    .update(collaborations)
    .set({ verifiedAt: new Date(Date.now() - SETTLE_WINDOW_MS - 60_000) })
    .where(eq(collaborations.id, id));

  await sweepSettlement(new InProcessBroker<CollabChanged>());
  const before = await get('/creator/wallet', creatorCookie);

  const second = await sweepSettlement(new InProcessBroker<CollabChanged>());
  const after = await get('/creator/wallet', creatorCookie);

  expect(second.map((entry) => entry.collaborationId)).not.toContain(id);
  expect(after.json<CreatorWallet>().balanceMinor).toBe(before.json<CreatorWallet>().balanceMinor);
}, TIMEOUT);

test('a creator withdraws what settled', async () => {
  const before = await get('/creator/wallet', creatorCookie);
  const balance = before.json<CreatorWallet>().balanceMinor;
  expect(balance).toBeGreaterThan(0);

  const response = await post(
    '/creator/wallet/withdraw',
    { amountMinor: balance },
    creatorCookie,
    `set-wd-${stamp}`
  );

  expect(response.statusCode).toBe(200);
  expect(response.json<CreatorWallet>().balanceMinor).toBe(0);
}, TIMEOUT);
