import { afterAll, beforeAll, expect, test } from 'bun:test';
import { creators, users } from '@lm/db';
import { eq, like } from 'drizzle-orm';
import { buildApp } from './app';
import { db } from './auth';

const TIMEOUT = 60_000;
const app = buildApp();
const stamp = Date.now();
const PASSWORD = 'correct-horse-battery';

type Injected = Awaited<ReturnType<typeof app.inject>>;

let brandCookie = '';
let creatorCookie = '';
let creatorId = '';
let campaignId = '';
let collabId = '';

const post = (url: string, body: unknown, cookie: string): Promise<Injected> =>
  app.inject({ method: 'POST', url, payload: body as never, headers: { cookie } });

const get = (url: string, cookie: string): Promise<Injected> =>
  app.inject({ method: 'GET', url, headers: { cookie } });

function cookieFrom(res: Injected) {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.filter(Boolean).map((c) => String(c).split(';')[0]).join('; ');
}

const move = (cookie: string, body: Record<string, unknown>) =>
  post(`/${cookie === brandCookie ? 'brand' : 'creator'}/collaborations/${collabId}/move`, body, cookie);

beforeAll(async () => {
  await app.ready();

  const brandSignup = await post(
    '/brand/signup',
    { email: `col${stamp}b@constraint.test`, password: PASSWORD, name: 'Collab Brand' },
    ''
  );
  brandCookie = cookieFrom(brandSignup);

  await post(
    '/brand/profile',
    {
      companyName: 'Loopwork',
      productUrl: 'https://loopwork.example.com',
      icp: {
        summary: 'Loopwork sells interview scheduling and structured scorecards to talent teams.',
        points: [
          'Companies between 50 and 500 people hiring 20 or more roles a year.',
          'Heads of talent and recruiting operations leads.',
          'Already run structured interviews in a spreadsheet.'
        ],
        buyerTitles: ['Head of Talent'],
        sectors: ['HR Tech', 'Recruiting', 'B2B SaaS']
      }
    },
    brandCookie
  );

  const creatorSignup = await post(
    '/creator/signup',
    { email: `col${stamp}c@constraint.test`, password: PASSWORD, name: 'Collab Creator' },
    ''
  );
  creatorCookie = cookieFrom(creatorSignup);

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, `col${stamp}c@constraint.test`))
    .limit(1);

  const [creator] = await db
    .insert(creators)
    .values({
      userId: user!.id,
      profileUrl: `https://www.linkedin.com/in/collab${stamp}`,
      name: 'Collab Creator',
      headline: 'HR Tech',
      topics: ['HR Tech'],
      ratePerPostMinor: 30_000,
      followers: 6000,
      engagementRate: 0.08,
      postsPerWeek: 2
    })
    .returning();
  creatorId = creator!.id;

  const campaign = await post(
    '/brand/campaigns',
    {
      title: 'Q3 Pipeline Push',
      objective: 'Convince heads of talent that a four week loop costs more than a bad hire.',
      keyMessages: ['Loop length is a decision-rights problem.'],
      doNot: ['No feature lists.'],
      deliverable: 'One LinkedIn post with a tracked link.',
      budgetMinMinor: 20_000,
      budgetMaxMinor: 45_000,
      source: 'ai'
    },
    brandCookie
  );
  campaignId = campaign.json<{ id: string }>().id;
}, TIMEOUT);

afterAll(async () => {
  await db.delete(users).where(like(users.email, 'col%@constraint.test'));
  await app.close();
}, TIMEOUT);

test('a brand invites a creator', async () => {
  const res = await post(
    '/brand/collaborations',
    { campaignId, creatorId, feeMinor: 30_000 },
    brandCookie
  );
  expect(res.statusCode).toBe(200);

  const body = res.json<{ id: string; state: string; reference: string }>();
  collabId = body.id;
  expect(body.state).toBe('invited');
  expect(body.reference).toMatch(/^A-/);
}, TIMEOUT);

test('the creator sees the invitation, the brand sees it too', async () => {
  const mine = await get('/creator/collaborations', creatorCookie);
  expect(mine.json<{ items: unknown[] }>().items).toHaveLength(1);

  const theirs = await get('/brand/collaborations', brandCookie);
  expect(theirs.json<{ items: unknown[] }>().items).toHaveLength(1);
}, TIMEOUT);

test('a brand cannot accept on the creator behalf', async () => {
  const res = await move(brandCookie, { event: 'accept' });
  expect(res.statusCode).toBe(409);
  expect(res.json<{ code: string }>().code).toBe('illegal_transition');
}, TIMEOUT);

test('the creator counters and the fee is recorded', async () => {
  const res = await move(creatorCookie, { event: 'counter', feeMinor: 39_500 });
  expect(res.statusCode).toBe(200);

  const body = res.json<{ collaboration: { state: string; counterRounds: number; counterFeeMinor: number } }>();
  expect(body.collaboration.state).toBe('countered');
  expect(body.collaboration.counterRounds).toBe(1);
  expect(body.collaboration.counterFeeMinor).toBe(39_500);
}, TIMEOUT);

test('the brand accepts the counter and the agreed fee becomes the counter fee', async () => {
  const res = await move(brandCookie, { event: 'accept' });
  expect(res.statusCode).toBe(200);

  const body = res.json<{ collaboration: { state: string; feeMinor: number }; effects: string[] }>();
  expect(body.collaboration.state).toBe('accepted');
  expect(body.collaboration.feeMinor).toBe(39_500);
  expect(body.effects).toContain('hold_escrow');
}, TIMEOUT);

test('accepting incremented the creator acceptance count', async () => {
  const [row] = await db.select().from(creators).where(eq(creators.id, creatorId)).limit(1);
  expect(row!.acceptedCount).toBe(1);
  expect(row!.deliveredCount).toBe(0);
}, TIMEOUT);

test('publishing is refused before a draft is approved', async () => {
  const res = await move(creatorCookie, { event: 'publish', postUrl: 'https://linkedin.com/p/1' });
  expect(res.statusCode).toBe(409);
  expect(res.json<{ message: string }>().message).toContain('accepted');
}, TIMEOUT);

test('the brief and draft flow reaches approval and mints a tracked link', async () => {
  expect((await move(brandCookie, { event: 'share_brief' })).statusCode).toBe(200);
  expect(
    (await move(creatorCookie, { event: 'submit_draft', draft: 'Your loop is a decision problem.' }))
      .statusCode
  ).toBe(200);

  const approved = await move(brandCookie, { event: 'approve' });
  expect(approved.statusCode).toBe(200);

  const body = approved.json<{ collaboration: { trackedLink: string | null }; effects: string[] }>();
  expect(body.effects).toContain('mint_tracked_link');
  expect(body.collaboration.trackedLink).toMatch(/^lpwk\.co\//);
}, TIMEOUT);

test('publishing needs the live post url even once the link exists', async () => {
  expect((await move(creatorCookie, { event: 'schedule' })).statusCode).toBe(200);

  const withoutUrl = await move(creatorCookie, { event: 'publish' });
  expect(withoutUrl.statusCode).toBe(409);
  expect(withoutUrl.json<{ message: string }>().message).toContain('URL of the live post');
}, TIMEOUT);

test('publishing succeeds with the post url and the cycle completes', async () => {
  const published = await move(creatorCookie, {
    event: 'publish',
    postUrl: 'https://www.linkedin.com/posts/collab-1'
  });
  expect(published.statusCode).toBe(200);

  const verified = await post(
    `/brand/collaborations/${collabId}/move`,
    { event: 'verify' },
    brandCookie
  );
  expect(verified.statusCode).toBe(409);

  const [before] = await db.select().from(creators).where(eq(creators.id, creatorId)).limit(1);
  expect(before!.deliveredCount).toBe(0);
}, TIMEOUT);

test('the audit log records every transition in order', async () => {
  const res = await get(`/brand/collaborations/${collabId}/events`, brandCookie);
  const items = res.json<{ items: { event: string; fromState: string; toState: string }[] }>().items;

  const events = items.map((i) => i.event).reverse();
  expect(events).toEqual([
    'accept',
    'counter',
    'accept',
    'share_brief',
    'submit_draft',
    'approve',
    'schedule',
    'publish'
  ]);
}, TIMEOUT);

test('the database refuses a published row without a tracked link', async () => {
  let message = '';
  try {
    await db.execute(
      `insert into collaborations (reference, campaign_id, creator_id, state, fee_minor)
       values ('A-BADROW', '${campaignId}', '${creatorId}', 'published', 1000)` as never
    );
  } catch (error) {
    message = (error as Error).message;
  }
  expect(message).toMatch(/collaborations_published_needs_link/i);
}, TIMEOUT);

test('a creator cannot accept the counter they just made', async () => {
  const brandSignup = await post(
    '/brand/signup',
    { email: `col${stamp}b2@constraint.test`, password: PASSWORD, name: 'Brand Two' },
    ''
  );
  const cookie2 = cookieFrom(brandSignup);

  await post(
    '/brand/profile',
    {
      companyName: 'Second',
      productUrl: 'https://second.example.com',
      icp: {
        summary: 'Second sells scheduling software to recruiting teams at growing companies.',
        points: ['Companies hiring 20 roles a year.', 'Talent leads.', 'Structured interviews.'],
        buyerTitles: ['Head of Talent'],
        sectors: ['HR Tech']
      }
    },
    cookie2
  );

  const campaign = await post(
    '/brand/campaigns',
    {
      title: 'Second Push',
      objective: 'Explain why loop length is a decision-rights problem, not a diligence one.',
      deliverable: 'One post.',
      budgetMinMinor: 10_000,
      budgetMaxMinor: 50_000,
      source: 'ai'
    },
    cookie2
  );

  const invited = await post(
    '/brand/collaborations',
    { campaignId: campaign.json<{ id: string }>().id, creatorId, feeMinor: 25_000 },
    cookie2
  );
  const second = invited.json<{ id: string }>().id;

  const countered = await post(
    `/creator/collaborations/${second}/move`,
    { event: 'counter', feeMinor: 44_000 },
    creatorCookie
  );
  expect(countered.statusCode).toBe(200);

  const selfAccept = await post(
    `/creator/collaborations/${second}/move`,
    { event: 'accept' },
    creatorCookie
  );
  expect(selfAccept.statusCode).toBe(409);
  expect(selfAccept.json<{ message: string }>().message).toContain('other side');

  const brandAccept = await post(
    `/brand/collaborations/${second}/move`,
    { event: 'accept' },
    cookie2
  );
  expect(brandAccept.statusCode).toBe(200);
  expect(brandAccept.json<{ collaboration: { feeMinor: number } }>().collaboration.feeMinor).toBe(44_000);
}, TIMEOUT);
