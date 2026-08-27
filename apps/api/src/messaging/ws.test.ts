import { afterAll, beforeAll, expect, test } from 'bun:test';
import { CloseCode, PROTOCOL_VERSION, type ServerFrame } from '@lm/contracts';
import { creators, users } from '@lm/db';
import { desc, eq, like } from 'drizzle-orm';
import { WebSocket } from 'ws';
import { buildApp } from '../app';
import { db } from '../auth';

const TIMEOUT = 60_000;
const app = buildApp();
const stamp = Date.now();
const PASSWORD = 'correct-horse-battery';

let base = '';
let brandCookie = '';
let creatorCookie = '';
let outsiderCookie = '';
let creatorId = '';
let roomCounter = 0;

async function newRoom() {
  roomCounter += 1;
  const campaign = await post(
    '/brand/campaigns',
    {
      title: `WS Room ${roomCounter}`,
      objective: 'Explain why a long interview loop costs more than a bad hire does.',
      deliverable: 'One post.',
      budgetMinMinor: 10_000,
      budgetMaxMinor: 50_000,
      source: 'ai'
    },
    brandCookie
  );

  const collab = await post(
    '/brand/collaborations',
    { campaignId: campaign.json<{ id: string }>().id, creatorId, feeMinor: 30_000 },
    brandCookie
  );
  return collab.json<{ id: string }>().id;
}

type Injected = Awaited<ReturnType<typeof app.inject>>;

const post = (url: string, body: unknown, cookie = ''): Promise<Injected> =>
  app.inject({ method: 'POST', url, payload: body as never, headers: cookie ? { cookie } : {} });

function cookieFrom(res: Injected) {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.filter(Boolean).map((c) => String(c).split(';')[0]).join('; ');
}

class Client {
  private readonly socket: WebSocket;
  readonly frames: ServerFrame[] = [];
  closeCode: number | null = null;

  constructor(cookie: string, id: string, after = 0) {
    this.socket = new WebSocket(`${base}/ws/collaborations/${id}?after=${after}`, {
      headers: { cookie }
    });
    this.socket.on('error', () => {});
    this.socket.on('message', (raw) => this.frames.push(JSON.parse(String(raw)) as ServerFrame));
    this.socket.on('close', (code) => {
      this.closeCode = code;
    });
  }

  static openOrFail(cookie: string, id: string, after = 0) {
    return new Promise<Client | { status: number }>((resolve) => {
      const client = new Client(cookie, id, after);
      let settled = false;
      const done = (value: Client | { status: number }) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      client.socket.once('open', () => done(client));
      client.socket.once('unexpected-response', (_req, res) => done({ status: res.statusCode ?? 0 }));
      client.socket.once('error', () => {
        setTimeout(() => done({ status: 0 }), 100);
      });
    });
  }

  send(frame: unknown) {
    this.socket.send(typeof frame === 'string' ? frame : JSON.stringify(frame));
  }

  async waitFor<T extends ServerFrame['t']>(type: T, count = 1, ms = 8000) {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      const found = this.frames.filter((f) => f.t === type);
      if (found.length >= count) return found as Extract<ServerFrame, { t: T }>[];
      await Bun.sleep(25);
    }
    throw new Error(`timed out waiting for ${count} "${type}" frames, saw ${JSON.stringify(this.frames.map((f) => f.t))}`);
  }

  async waitForClose(ms = 8000) {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      if (this.closeCode !== null) return this.closeCode;
      await Bun.sleep(25);
    }
    throw new Error('socket did not close');
  }

  close() {
    this.socket.close();
  }
}

beforeAll(async () => {
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  base = `ws://127.0.0.1:${port}`;

  brandCookie = cookieFrom(
    await post('/brand/signup', {
      email: `ws${stamp}b@constraint.test`,
      password: PASSWORD,
      name: 'WS Brand'
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
      email: `ws${stamp}c@constraint.test`,
      password: PASSWORD,
      name: 'WS Creator'
    })
  );

  outsiderCookie = cookieFrom(
    await post('/creator/signup', {
      email: `ws${stamp}o@constraint.test`,
      password: PASSWORD,
      name: 'WS Outsider'
    })
  );

  const [creatorUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, `ws${stamp}c@constraint.test`))
    .limit(1);

  const [creator] = await db
    .insert(creators)
    .values({
      userId: creatorUser!.id,
      profileUrl: `https://www.linkedin.com/in/ws${stamp}`,
      name: 'WS Creator',
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
  await Bun.sleep(150);
  await db.delete(users).where(like(users.email, 'ws%@constraint.test'));
}, TIMEOUT);

test('an unauthenticated upgrade is refused with 401, no socket is opened', async () => {
  const collabId = await newRoom();
  const result = await Client.openOrFail('', collabId);
  expect('status' in result).toBe(true);
  if ('status' in result) expect(result.status).toBe(401);
}, TIMEOUT);

test('a signed-in account that is not a participant is refused with 404', async () => {
  const collabId = await newRoom();
  const result = await Client.openOrFail(outsiderCookie, collabId);
  expect('status' in result).toBe(true);
  if ('status' in result) expect(result.status).toBe(404);
}, TIMEOUT);

test('a participant connects and receives ready before anything else', async () => {
  const collabId = await newRoom();
  const client = (await Client.openOrFail(brandCookie, collabId)) as Client;
  const [ready] = await client.waitFor('ready');

  expect(client.frames[0]!.t).toBe('ready');
  expect(ready!.version).toBe(PROTOCOL_VERSION);
  expect(ready!.you).toBe('brand');
  expect(ready!.lastSeq).toBe(0);
  expect(ready!.replayed).toBe(0);

  client.close();
}, TIMEOUT);

test('a message is persisted, acked, and delivered to the other side', async () => {
  const collabId = await newRoom();
  const brand = (await Client.openOrFail(brandCookie, collabId)) as Client;
  const creator = (await Client.openOrFail(creatorCookie, collabId)) as Client;
  await Promise.all([brand.waitFor('ready'), creator.waitFor('ready')]);

  const id = crypto.randomUUID();
  brand.send({ t: 'send', id, body: 'Can you take this by the twelfth?' });

  const [ack] = await brand.waitFor('ack');
  expect(ack!.id).toBe(id);
  expect(ack!.seq).toBe(1);

  const [delivered] = await creator.waitFor('message');
  expect(delivered!.message.body).toBe('Can you take this by the twelfth?');
  expect(delivered!.message.sender).toBe('brand');
  expect(delivered!.message.senderName).toBe('Loopwork');
  expect(delivered!.message.seq).toBe(1);

  brand.close();
  creator.close();
}, TIMEOUT);

test('resending the same client id is idempotent and does not consume a sequence', async () => {
  const collabId = await newRoom();
  const brand = (await Client.openOrFail(brandCookie, collabId)) as Client;
  await brand.waitFor('ready');

  const id = crypto.randomUUID();
  brand.send({ t: 'send', id, body: 'Sent once.' });
  const [first] = await brand.waitFor('ack');

  brand.send({ t: 'send', id, body: 'Sent once.' });
  const acks = await brand.waitFor('ack', 2);

  expect(acks[1]!.seq).toBe(first!.seq);
  expect(brand.frames.filter((f) => f.t === 'message' && f.message.id === id)).toHaveLength(1);

  brand.close();
}, TIMEOUT);

test('reconnecting with a cursor replays only what was missed', async () => {
  const collabId = await newRoom();
  const brand = (await Client.openOrFail(brandCookie, collabId)) as Client;
  const [ready] = await brand.waitFor('ready');
  const before = ready!.lastSeq;

  brand.send({ t: 'send', id: crypto.randomUUID(), body: 'One.' });
  brand.send({ t: 'send', id: crypto.randomUUID(), body: 'Two.' });
  await brand.waitFor('ack', 2);
  brand.close();

  const resumed = (await Client.openOrFail(creatorCookie, collabId, before)) as Client;
  const [resumedReady] = await resumed.waitFor('ready');

  expect(resumedReady!.replayed).toBe(2);
  const bodies = (await resumed.waitFor('message', 2)).map((f) => f.message.body);
  expect(bodies).toEqual(['One.', 'Two.']);

  resumed.close();
}, TIMEOUT);

test('connecting at the head replays nothing', async () => {
  const collabId = await newRoom();
  const peek = (await Client.openOrFail(brandCookie, collabId)) as Client;
  const [ready] = await peek.waitFor('ready');
  peek.close();

  const head = (await Client.openOrFail(brandCookie, collabId, ready!.lastSeq)) as Client;
  const [headReady] = await head.waitFor('ready');
  expect(headReady!.replayed).toBe(0);
  head.close();
}, TIMEOUT);

test('messages keep their order under a concurrent burst', async () => {
  const collabId = await newRoom();
  const sender = (await Client.openOrFail(creatorCookie, collabId)) as Client;
  const watcher = (await Client.openOrFail(brandCookie, collabId)) as Client;
  const [watcherReady] = await watcher.waitFor('ready');
  await sender.waitFor('ready');

  const bodies = Array.from({ length: 10 }, (_, i) => `burst ${i}`);
  for (const body of bodies) sender.send({ t: 'send', id: crypto.randomUUID(), body });

  await sender.waitFor('ack', 10);
  const received = await watcher.waitFor('message', 10);

  const seqs = received.map((f) => f.message.seq);
  expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
  expect(new Set(seqs).size).toBe(10);
  expect(seqs[0]).toBe(watcherReady!.lastSeq + 1);
  expect(received.map((f) => f.message.body)).toEqual(bodies);

  sender.close();
  watcher.close();
}, TIMEOUT);

test('a malformed frame is rejected without closing the socket', async () => {
  const collabId = await newRoom();
  const client = (await Client.openOrFail(brandCookie, collabId)) as Client;
  await client.waitFor('ready');

  client.send('not json at all');
  const [error] = await client.waitFor('error');
  expect(error!.code).toBe('bad_frame');
  expect(client.closeCode).toBeNull();

  client.send({ t: 'ping' });
  await client.waitFor('pong');

  client.close();
}, TIMEOUT);

test('an oversized body is rejected with a specific code', async () => {
  const collabId = await newRoom();
  const client = (await Client.openOrFail(brandCookie, collabId)) as Client;
  await client.waitFor('ready');

  const id = crypto.randomUUID();
  client.send({ t: 'send', id, body: 'x'.repeat(4001) });

  const [error] = await client.waitFor('error');
  expect(error!.code).toBe('body_too_long');
  expect(error!.id).toBe(id);

  client.close();
}, TIMEOUT);

test('an empty body is rejected as a bad frame', async () => {
  const collabId = await newRoom();
  const client = (await Client.openOrFail(brandCookie, collabId)) as Client;
  await client.waitFor('ready');

  client.send({ t: 'send', id: crypto.randomUUID(), body: '   ' });
  const [error] = await client.waitFor('error');
  expect(error!.code).toBe('bad_frame');

  client.close();
}, TIMEOUT);

test('sustained sending trips the rate limit rather than the database', async () => {
  const collabId = await newRoom();
  const client = (await Client.openOrFail(brandCookie, collabId)) as Client;
  await client.waitFor('ready');

  for (let i = 0; i < 40; i += 1) {
    client.send({ t: 'send', id: crypto.randomUUID(), body: `flood ${i}` });
  }

  const [error] = await client.waitFor('error');
  expect(error!.code).toBe('rate_limited');

  client.close();
}, TIMEOUT);

test('the REST history endpoint agrees with the socket', async () => {
  const collabId = await newRoom();
  const client = (await Client.openOrFail(brandCookie, collabId)) as Client;
  const [ready] = await client.waitFor('ready');
  client.close();

  const res = await app.inject({
    method: 'GET',
    url: `/brand/collaborations/${collabId}/messages?after=0&limit=500`,
    headers: { cookie: brandCookie }
  });

  expect(res.statusCode).toBe(200);
  const page = res.json<{ items: { seq: number }[]; lastSeq: number }>();
  expect(page.lastSeq).toBe(ready!.lastSeq);
  expect(page.items.map((i) => i.seq)).toEqual(page.items.map((i) => i.seq).sort((a, b) => a - b));
}, TIMEOUT);

test('history is refused to an account that is not a participant', async () => {
  const collabId = await newRoom();
  const res = await app.inject({
    method: 'GET',
    url: `/creator/collaborations/${collabId}/messages`,
    headers: { cookie: outsiderCookie }
  });
  expect(res.statusCode).toBe(404);
}, TIMEOUT);

test('a closed socket stops receiving and frees its room slot', async () => {
  const collabId = await newRoom();
  const client = (await Client.openOrFail(brandCookie, collabId)) as Client;
  await client.waitFor('ready');
  const seen = client.frames.length;

  client.close();
  await client.waitForClose();

  const other = (await Client.openOrFail(creatorCookie, collabId)) as Client;
  await other.waitFor('ready');
  other.send({ t: 'send', id: crypto.randomUUID(), body: 'after the close' });
  await other.waitFor('ack');
  await Bun.sleep(200);

  expect(client.frames.length).toBe(seen);
  other.close();
}, TIMEOUT);
