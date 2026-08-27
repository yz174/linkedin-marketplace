import { afterAll, beforeAll, expect, test } from 'bun:test';
import type { DraftCampaignResponse } from '@lm/contracts';
import { users } from '@lm/db';
import { like } from 'drizzle-orm';
import { buildApp } from './app';
import { db } from './auth';

const TIMEOUT = 60_000;
const app = buildApp();
const stamp = Date.now();
const PASSWORD = 'correct-horse-battery';

let cookie = '';

type Injected = Awaited<ReturnType<typeof app.inject>>;

const post = (url: string, body: unknown, auth = ''): Promise<Injected> =>
  app.inject({ method: 'POST', url, payload: body as never, headers: auth ? { cookie: auth } : {} });

beforeAll(async () => {
  const signup = await post('/brand/signup', {
    email: `cmp${stamp}@constraint.test`,
    password: PASSWORD,
    name: 'Campaign Brand'
  });
  const raw = signup.headers['set-cookie'];
  cookie = (Array.isArray(raw) ? raw : [raw])
    .filter(Boolean)
    .map((c) => String(c).split(';')[0])
    .join('; ');

  await post(
    '/brand/profile',
    {
      companyName: 'Ashby',
      productUrl: 'https://www.ashbyhq.com',
      icp: {
        summary: 'Ashby sells applicant tracking, scheduling, and analytics to talent teams.',
        points: [
          'Companies of 50 to 500 people.',
          'Talent leads who own the interview loop.',
          'Teams replacing several point tools with one system.'
        ],
        buyerTitles: ['Head of Talent'],
        sectors: ['Recruiting', 'HR Tech', 'B2B SaaS']
      }
    },
    cookie
  );
}, TIMEOUT);

afterAll(async () => {
  await db.delete(users).where(like(users.email, 'cmp%@constraint.test'));
  await app.close();
}, TIMEOUT);

test('a product page becomes an editable campaign draft', async () => {
  const response = await post('/brand/campaigns/draft', { url: 'https://www.ashbyhq.com' }, cookie);
  expect(response.statusCode).toBe(200);

  const body = response.json<DraftCampaignResponse>();
  expect(body.source).toBe('url');
  expect(body.sourceRef).toBe('https://www.ashbyhq.com');
  expect(body.charsRead).toBeGreaterThan(400);
  expect(body.draft.title.length).toBeGreaterThan(2);
  expect(body.draft.keyMessages.length).toBeGreaterThanOrEqual(2);
  expect(body.draft.doNot.length).toBeGreaterThanOrEqual(1);
  expect(body.draft.objective).not.toContain('—');
}, TIMEOUT);

test('a pasted brief becomes a draft without reading any page', async () => {
  const response = await post(
    '/brand/campaigns/draft',
    {
      pastedBrief: [
        'We are launching structured interview scorecards in September.',
        'Buyers are heads of talent at companies between 50 and 500 people.',
        'The problem is that interview structure lives in spreadsheets nobody opens during the interview.',
        'We want creators to argue that an unstructured loop is a decision-rights problem, not a tooling problem.'
      ].join(' ')
    },
    cookie
  );
  expect(response.statusCode).toBe(200);

  const body = response.json<DraftCampaignResponse>();
  expect(body.source).toBe('pasted');
  expect(body.sourceRef).toBe('pasted brief');
  expect(body.draft.deliverable.length).toBeGreaterThan(9);
}, TIMEOUT);

test('sending both a url and a brief is refused', async () => {
  const response = await post(
    '/brand/campaigns/draft',
    { url: 'https://www.ashbyhq.com', pastedBrief: 'x'.repeat(60) },
    cookie
  );
  expect(response.statusCode).toBe(400);
});

test('sending neither a url nor a brief is refused', async () => {
  const response = await post('/brand/campaigns/draft', {}, cookie);
  expect(response.statusCode).toBe(400);
});

test('a drafted campaign saves with its source recorded', async () => {
  const drafted = await post('/brand/campaigns/draft', { url: 'https://www.ashbyhq.com' }, cookie);
  const { draft, sourceRef } = drafted.json<DraftCampaignResponse>();

  const created = await post(
    '/brand/campaigns',
    {
      ...draft,
      budgetMinMinor: 20_000,
      budgetMaxMinor: 45_000,
      source: 'url',
      sourceRef
    },
    cookie
  );

  expect(created.statusCode).toBe(200);
  const row = created.json<{ source: string; sourceRef: string; title: string }>();
  expect(row.source).toBe('url');
  expect(row.sourceRef).toBe('https://www.ashbyhq.com');
  expect(row.title).toBe(draft.title);
}, TIMEOUT);

async function upload(name: string, bytes: Uint8Array) {
  const form = new FormData();
  form.append('file', new Blob([bytes as BlobPart]), name);
  const encoded = new Response(form);

  const contentType = encoded.headers.get('content-type')!;
  const payload = Buffer.from(await encoded.arrayBuffer());

  return app.inject({
    method: 'POST',
    url: '/brand/campaigns/draft/document',
    payload,
    headers: { cookie, 'content-type': contentType }
  });
}

const fixture = (name: string) =>
  Bun.file(new URL(`../../../packages/ai/fixtures/${name}`, import.meta.url)).bytes();

test('an uploaded deck becomes a draft with the filename recorded', async () => {
  const response = await upload('brief.pptx', await fixture('brief.pptx'));
  expect(response.statusCode).toBe(200);

  const body = response.json<DraftCampaignResponse>();
  expect(body.source).toBe('document');
  expect(body.sourceRef).toBe('brief.pptx');
  expect(body.charsRead).toBeGreaterThan(100);
  expect(body.draft.keyMessages.length).toBeGreaterThanOrEqual(2);
}, TIMEOUT);

test('an uploaded PDF is read on the Bun runtime', async () => {
  const response = await upload('brief.pdf', await fixture('brief.pdf'));
  expect(response.statusCode).toBe(200);
  expect(response.json<DraftCampaignResponse>().source).toBe('document');
}, TIMEOUT);

test('a file type we cannot read is refused with its name', async () => {
  const response = await upload('deck.key', new TextEncoder().encode('not a deck'));
  expect(response.statusCode).toBe(415);
  expect(response.json<{ code: string; message: string }>().code).toBe('unsupported_document');
  expect(response.json<{ message: string }>().message).toContain('deck.key');
});
