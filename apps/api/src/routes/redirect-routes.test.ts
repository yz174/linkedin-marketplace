import { afterAll, beforeAll, expect, test } from 'bun:test';
import type { BrandAnalytics } from '@lm/contracts';
import { collaborations, creators, linkClicks, users } from '@lm/db';
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
let collaborationId = '';
let code = '';

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

function cookieFrom(res: Injected) {
  const raw = res.headers['set-cookie'];
  return (Array.isArray(raw) ? raw : [raw])
    .filter(Boolean)
    .map((c) => String(c).split(';')[0])
    .join('; ');
}

const click = (visitor: string) =>
  app.inject({
    method: 'GET',
    url: `/r/${code}`,
    headers: { 'user-agent': visitor },
    remoteAddress: '203.0.113.4'
  });

beforeAll(async () => {
  brandCookie = cookieFrom(
    await post('/brand/signup', {
      email: `red${stamp}b@constraint.test`,
      password: PASSWORD,
      name: 'Redirect Brand'
    })
  );
  await post(
    '/brand/profile',
    {
      companyName: 'Redirectworks',
      productUrl: 'https://redirectworks.example.com',
      icp: {
        summary: 'Redirectworks sells interview scheduling to talent teams.',
        points: ['Companies of 50 to 500 people.', 'Talent leads.', 'Structured interviews.'],
        buyerTitles: ['Head of Talent'],
        sectors: ['HR Tech']
      }
    },
    brandCookie
  );
  await post('/brand/wallet/topup', { amountMinor: 200_000 }, brandCookie, `red-fund-${stamp}`);

  creatorCookie = cookieFrom(
    await post('/creator/signup', {
      email: `red${stamp}c@constraint.test`,
      password: PASSWORD,
      name: 'Redirect Creator'
    })
  );

  const [creatorUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, `red${stamp}c@constraint.test`))
    .limit(1);

  const [creator] = await db
    .insert(creators)
    .values({
      userId: creatorUser!.id,
      profileUrl: `https://www.linkedin.com/in/red${stamp}`,
      name: 'Redirect Creator',
      topics: ['HR Tech'],
      ratePerPostMinor: 30_000
    })
    .returning();
  creatorId = creator!.id;

  const campaign = await post(
    '/brand/campaigns',
    {
      title: 'Redirect campaign',
      objective: 'Explain why a long interview loop costs more than a bad hire does.',
      deliverable: 'One post.',
      budgetMinMinor: 10_000,
      budgetMaxMinor: 50_000,
      source: 'ai',
      landingUrl: 'https://redirectworks.example.com/pricing'
    },
    brandCookie
  );

  const created = await post(
    '/brand/collaborations',
    { campaignId: campaign.json<{ id: string }>().id, creatorId, feeMinor: 30_000 },
    brandCookie
  );
  collaborationId = created.json<{ id: string }>().id;

  const creatorMove = (body: unknown) =>
    post(`/creator/collaborations/${collaborationId}/move`, body, creatorCookie);
  const brandMove = (body: unknown) =>
    post(`/brand/collaborations/${collaborationId}/move`, body, brandCookie);

  await creatorMove({ event: 'accept' });
  await brandMove({ event: 'share_brief' });
  await creatorMove({ event: 'submit_draft', draft: 'A draft post.' });
  await brandMove({ event: 'approve' });

  const [row] = await db
    .select()
    .from(collaborations)
    .where(eq(collaborations.id, collaborationId))
    .limit(1);
  code = row!.trackedLink!.split('/r/')[1]!;
}, TIMEOUT);

afterAll(async () => {
  await app.close();
  await db.delete(users).where(like(users.email, 'red%@constraint.test'));
}, TIMEOUT);

test('the minted link points at our redirect, not a display string', () => {
  expect(code).toMatch(/^[a-z0-9]+$/);
}, TIMEOUT);

test('a click redirects to the campaign landing page', async () => {
  const response = await click('probe/1.0');

  expect(response.statusCode).toBe(302);
  expect(response.headers.location).toBe('https://redirectworks.example.com/pricing');
}, TIMEOUT);

test('the same visitor clicking again counts hits, not visitors', async () => {
  await click('probe/1.0');
  await click('probe/1.0');

  const rows = await db
    .select()
    .from(linkClicks)
    .where(eq(linkClicks.collaborationId, collaborationId));

  expect(rows).toHaveLength(1);
  expect(rows[0]!.hits).toBeGreaterThanOrEqual(3);
}, TIMEOUT);

test('a different visitor is counted separately', async () => {
  await click('other-browser/2.0');

  const rows = await db
    .select()
    .from(linkClicks)
    .where(eq(linkClicks.collaborationId, collaborationId));

  expect(rows).toHaveLength(2);
}, TIMEOUT);

test('an unknown code is a 404 rather than an open redirect', async () => {
  const response = await app.inject({ method: 'GET', url: '/r/nosuchcode' });
  expect(response.statusCode).toBe(404);
}, TIMEOUT);

test('analytics counts the clicks and the money against the campaign', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/brand/analytics',
    headers: { cookie: brandCookie }
  });
  expect(response.statusCode).toBe(200);

  const body = response.json<BrandAnalytics>();
  const campaign = body.campaigns.find((row) => row.title === 'Redirect campaign');

  expect(campaign).toBeDefined();
  expect(campaign!.assignments).toBe(1);
  expect(campaign!.clicks).toBeGreaterThanOrEqual(4);
  expect(campaign!.visitors).toBe(2);
  expect(campaign!.committedMinor).toBe(30_000);
  expect(campaign!.spendMinor).toBe(0);
  expect(campaign!.costPerClickMinor).toBe(0);
  expect(body.totals.visitors).toBeGreaterThanOrEqual(2);
}, TIMEOUT);
