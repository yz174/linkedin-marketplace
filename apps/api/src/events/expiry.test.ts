import { afterAll, beforeAll, expect, test } from 'bun:test';
import type { CollabChanged } from '@lm/contracts';
import { collaborationEvents, collaborations, creators, users } from '@lm/db';
import { and, desc, eq, like } from 'drizzle-orm';
import { buildApp } from '../app';
import { db } from '../auth';
import { creatorRoom } from './bus';
import { RESPONSE_WINDOW_MS, sweepExpiries } from './expiry';
import { InProcessBroker } from '../messaging/broker';

const TIMEOUT = 60_000;
const app = buildApp();
const stamp = Date.now();
const PASSWORD = 'correct-horse-battery';

let brandCookie = '';
let creatorCookie = '';
let creatorId = '';

type Injected = Awaited<ReturnType<typeof app.inject>>;

const post = (url: string, body: unknown, cookie = ''): Promise<Injected> =>
  app.inject({ method: 'POST', url, payload: body as never, headers: cookie ? { cookie } : {} });

function cookieFrom(res: Injected) {
  const raw = res.headers['set-cookie'];
  return (Array.isArray(raw) ? raw : [raw])
    .filter(Boolean)
    .map((c) => String(c).split(';')[0])
    .join('; ');
}

async function newCampaign(title: string) {
  const created = await post(
    '/brand/campaigns',
    {
      title,
      objective: 'Explain why a long interview loop costs more than a bad hire does.',
      deliverable: 'One post.',
      budgetMinMinor: 10_000,
      budgetMaxMinor: 50_000,
      source: 'ai'
    },
    brandCookie
  );
  return created.json<{ id: string }>().id;
}

async function invite(title: string, publishBy?: Date) {
  const created = await post(
    '/brand/collaborations',
    {
      campaignId: await newCampaign(title),
      creatorId,
      feeMinor: 30_000,
      ...(publishBy ? { publishBy: publishBy.toISOString() } : {})
    },
    brandCookie
  );
  expect(created.statusCode).toBe(200);
  return created.json<{ id: string }>().id;
}

const stateOf = async (id: string) => {
  const [row] = await db.select().from(collaborations).where(eq(collaborations.id, id)).limit(1);
  return row!.state;
};

beforeAll(async () => {
  brandCookie = cookieFrom(
    await post('/brand/signup', {
      email: `exp${stamp}b@constraint.test`,
      password: PASSWORD,
      name: 'Expiry Brand'
    })
  );
  await post(
    '/brand/profile',
    {
      companyName: 'Loopwork',
      productUrl: 'https://loopwork.example.com',
      icp: {
        summary: 'Loopwork sells interview scheduling and structured scorecards to talent teams.',
        points: ['Companies of 50 to 500 people.', 'Talent leads.', 'Structured interviews.'],
        buyerTitles: ['Head of Talent'],
        sectors: ['HR Tech']
      }
    },
    brandCookie
  );

  creatorCookie = cookieFrom(
    await post('/creator/signup', {
      email: `exp${stamp}c@constraint.test`,
      password: PASSWORD,
      name: 'Expiry Creator'
    })
  );

  const [creatorUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, `exp${stamp}c@constraint.test`))
    .limit(1);

  const [creator] = await db
    .insert(creators)
    .values({
      userId: creatorUser!.id,
      profileUrl: `https://www.linkedin.com/in/exp${stamp}`,
      name: 'Expiry Creator',
      headline: 'HR Tech',
      topics: ['HR Tech'],
      ratePerPostMinor: 30_000,
      followers: 5000,
      engagementRate: 0.08,
      postsPerWeek: 2
    })
    .returning();
  creatorId = creator!.id;
}, TIMEOUT);

afterAll(async () => {
  await app.close();
  await db.delete(users).where(like(users.email, 'exp%@constraint.test'));
}, TIMEOUT);

test('an accepted assignment past its publish date expires and records the refund', async () => {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const id = await invite('Expiry publish clock', yesterday);

  await post(`/creator/collaborations/${id}/move`, { event: 'accept' }, creatorCookie);
  expect(await stateOf(id)).toBe('accepted');

  const bus = new InProcessBroker<CollabChanged>();
  const frames: CollabChanged[] = [];
  bus.subscribe(creatorRoom(creatorId), (frame) => frames.push(frame));

  const expired = await sweepExpiries(bus);
  const mine = expired.find((entry) => entry.collaborationId === id);

  expect(mine).toBeDefined();
  expect(mine!.reason).toBe('not_published');
  expect(mine!.refunded).toBe(true);
  expect(await stateOf(id)).toBe('expired');

  const [event] = await db
    .select()
    .from(collaborationEvents)
    .where(and(eq(collaborationEvents.collaborationId, id), eq(collaborationEvents.event, 'expire')))
    .orderBy(desc(collaborationEvents.createdAt))
    .limit(1);

  expect(event!.actor).toBe('system');
  expect((event!.payload as { effects: string[] }).effects).toContain('refund_escrow');

  expect(frames.filter((frame) => frame.collaborationId === id)).toHaveLength(1);
  expect(frames.find((frame) => frame.collaborationId === id)!.to).toBe('expired');
}, TIMEOUT);

test('an invitation nobody answered inside the window expires without a refund', async () => {
  const id = await invite('Expiry response clock');
  await db
    .update(collaborations)
    .set({ invitedAt: new Date(Date.now() - RESPONSE_WINDOW_MS - 60_000) })
    .where(eq(collaborations.id, id));

  const expired = await sweepExpiries(new InProcessBroker<CollabChanged>());
  const mine = expired.find((entry) => entry.collaborationId === id);

  expect(mine).toBeDefined();
  expect(mine!.reason).toBe('no_response');
  expect(mine!.refunded).toBe(false);
  expect(await stateOf(id)).toBe('expired');
}, TIMEOUT);

test('a fresh invitation and a live deadline are both left alone', async () => {
  const fresh = await invite('Expiry fresh invite');
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const inTime = await invite('Expiry live deadline', tomorrow);
  await post(`/creator/collaborations/${inTime}/move`, { event: 'accept' }, creatorCookie);

  const expired = await sweepExpiries(new InProcessBroker<CollabChanged>());
  const touched = expired.map((entry) => entry.collaborationId);

  expect(touched).not.toContain(fresh);
  expect(touched).not.toContain(inTime);
  expect(await stateOf(fresh)).toBe('invited');
  expect(await stateOf(inTime)).toBe('accepted');
}, TIMEOUT);

test('a second sweep finds nothing left to expire', async () => {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const id = await invite('Expiry idempotent', yesterday);
  await post(`/creator/collaborations/${id}/move`, { event: 'accept' }, creatorCookie);

  await sweepExpiries(new InProcessBroker<CollabChanged>());
  const second = await sweepExpiries(new InProcessBroker<CollabChanged>());

  expect(second.map((entry) => entry.collaborationId)).not.toContain(id);
  expect(await stateOf(id)).toBe('expired');
}, TIMEOUT);
