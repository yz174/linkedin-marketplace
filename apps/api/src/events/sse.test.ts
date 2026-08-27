import { afterAll, beforeAll, expect, test } from 'bun:test';
import { type CollabChanged, type StatusFrame } from '@lm/contracts';
import { creators, users } from '@lm/db';
import { eq, like } from 'drizzle-orm';
import { buildApp } from '../app';
import { db } from '../auth';

const TIMEOUT = 60_000;
const app = buildApp();
const stamp = Date.now();
const PASSWORD = 'correct-horse-battery';

let base = '';
let brandCookie = '';
let otherBrandCookie = '';
let creatorCookie = '';
let creatorId = '';

type Injected = Awaited<ReturnType<typeof app.inject>>;

const post = (url: string, body: unknown, cookie = ''): Promise<Injected> =>
  app.inject({ method: 'POST', url, payload: body as never, headers: cookie ? { cookie } : {} });

function cookieFrom(res: Injected) {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .filter(Boolean)
    .map((c) => String(c).split(';')[0])
    .join('; ');
}

async function profileFor(cookie: string, companyName: string) {
  await post(
    '/brand/profile',
    {
      companyName,
      productUrl: `https://${companyName.toLowerCase()}.example.com`,
      icp: {
        summary: 'Sells interview scheduling and structured scorecards to talent teams.',
        points: ['Companies of 50 to 500 people.', 'Talent leads.', 'Structured interviews.'],
        buyerTitles: ['Head of Talent'],
        sectors: ['HR Tech']
      }
    },
    cookie
  );
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

type Stream = {
  frames: StatusFrame[];
  waitFor: (t: StatusFrame['t'], ms?: number) => Promise<StatusFrame>;
  close: () => void;
};

async function openStream(path: string, cookie: string): Promise<Stream> {
  const controller = new AbortController();
  const response = await fetch(`${base}${path}`, {
    headers: { cookie, accept: 'text/event-stream' },
    signal: controller.signal
  });

  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('text/event-stream');

  const frames: StatusFrame[] = [];
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  void (async () => {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        buffer += decoder.decode(value, { stream: true });

        let split = buffer.indexOf('\n\n');
        while (split !== -1) {
          const block = buffer.slice(0, split);
          buffer = buffer.slice(split + 2);
          const data = block
            .split('\n')
            .find((line) => line.startsWith('data: '))
            ?.slice(6);
          if (data) frames.push(JSON.parse(data) as StatusFrame);
          split = buffer.indexOf('\n\n');
        }
      }
    } catch {
      return;
    }
  })();

  const waitFor = async (t: StatusFrame['t'], ms = 5000) => {
    const deadline = Date.now() + ms;
    for (;;) {
      const found = frames.find((f) => f.t === t);
      if (found) return found;
      if (Date.now() > deadline) throw new Error(`no ${t} frame within ${ms}ms`);
      await Bun.sleep(25);
    }
  };

  return { frames, waitFor, close: () => controller.abort() };
}

beforeAll(async () => {
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;

  brandCookie = cookieFrom(
    await post('/brand/signup', {
      email: `sse${stamp}b@constraint.test`,
      password: PASSWORD,
      name: 'SSE Brand'
    })
  );
  await profileFor(brandCookie, 'Loopwork');

  otherBrandCookie = cookieFrom(
    await post('/brand/signup', {
      email: `sse${stamp}x@constraint.test`,
      password: PASSWORD,
      name: 'SSE Other Brand'
    })
  );
  await profileFor(otherBrandCookie, 'Sideline');

  creatorCookie = cookieFrom(
    await post('/creator/signup', {
      email: `sse${stamp}c@constraint.test`,
      password: PASSWORD,
      name: 'SSE Creator'
    })
  );

  const [creatorUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, `sse${stamp}c@constraint.test`))
    .limit(1);

  const [creator] = await db
    .insert(creators)
    .values({
      userId: creatorUser!.id,
      profileUrl: `https://www.linkedin.com/in/sse${stamp}`,
      name: 'SSE Creator',
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
  await db.delete(users).where(like(users.email, 'sse%@constraint.test'));
}, TIMEOUT);

test('an unauthenticated stream request is refused', async () => {
  const response = await fetch(`${base}/brand/events`, { headers: { accept: 'text/event-stream' } });
  expect(response.status).toBe(401);
  await response.text();
});

test('a stream opens with a hello frame naming the side', async () => {
  const stream = await openStream('/creator/events', creatorCookie);
  const hello = await stream.waitFor('hello');
  expect(hello).toMatchObject({ t: 'hello', version: 1, side: 'creator' });
  stream.close();
});

test('an invitation reaches the creator without a request from the client', async () => {
  const stream = await openStream('/creator/events', creatorCookie);
  await stream.waitFor('hello');

  const invited = await post(
    '/brand/collaborations',
    { campaignId: await newCampaign('SSE Invite'), creatorId, feeMinor: 30_000 },
    brandCookie
  );
  expect(invited.statusCode).toBe(200);
  const collaborationId = invited.json<{ id: string }>().id;

  const frame = (await stream.waitFor('collab_changed')) as CollabChanged;
  expect(frame.collaborationId).toBe(collaborationId);
  expect(frame.to).toBe('invited');
  expect(frame.feeMinor).toBe(30_000);
  stream.close();
});

test('a counter reaches the brand that owns the campaign, and no other brand', async () => {
  const invited = await post(
    '/brand/collaborations',
    { campaignId: await newCampaign('SSE Counter'), creatorId, feeMinor: 25_000 },
    brandCookie
  );
  expect(invited.statusCode).toBe(200);
  const collaborationId = invited.json<{ id: string }>().id;

  const mine = await openStream('/brand/events', brandCookie);
  const theirs = await openStream('/brand/events', otherBrandCookie);
  await mine.waitFor('hello');
  await theirs.waitFor('hello');

  const moved = await post(
    `/creator/collaborations/${collaborationId}/move`,
    { event: 'counter', feeMinor: 40_000 },
    creatorCookie
  );
  expect(moved.statusCode).toBe(200);

  const frame = (await mine.waitFor('collab_changed')) as CollabChanged;
  expect(frame.collaborationId).toBe(collaborationId);
  expect(frame.from).toBe('invited');
  expect(frame.to).toBe('countered');
  expect(frame.counterFeeMinor).toBe(40_000);
  expect(frame.actor).toBe('creator');

  expect(theirs.frames.filter((f) => f.t === 'collab_changed')).toHaveLength(0);
  mine.close();
  theirs.close();
}, TIMEOUT);
