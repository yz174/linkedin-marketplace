import { afterAll, beforeAll, expect, test } from 'bun:test';
import type { CatalogResponse, BrandProfile, GenerateIcpResponse } from '@lm/contracts';
import { users } from '@lm/db';
import { like } from 'drizzle-orm';
import { buildApp } from './app';
import { db } from './auth';

const TIMEOUT = 60_000;
const app = buildApp();
const stamp = Date.now();
const PASSWORD = 'correct-horse-battery';

let brandCookie = '';

type Injected = Awaited<ReturnType<typeof app.inject>>;

const post = (url: string, body: unknown, cookie = ''): Promise<Injected> =>
  app.inject({ method: 'POST', url, payload: body as never, headers: cookie ? { cookie } : {} });

const get = (url: string, cookie = ''): Promise<Injected> =>
  app.inject({ method: 'GET', url, headers: cookie ? { cookie } : {} });

function cookieFrom(res: Injected) {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.filter(Boolean).map((c) => String(c).split(';')[0]).join('; ');
}

beforeAll(async () => {
  await app.ready();
  const signup = await post('/brand/signup', {
    email: `onb${stamp}@constraint.test`,
    password: PASSWORD,
    name: 'Onboarding Brand'
  });
  brandCookie = cookieFrom(signup);
}, TIMEOUT);

afterAll(async () => {
  await db.delete(users).where(like(users.email, 'onb%@constraint.test'));
  await app.close();
}, TIMEOUT);

test('the catalog is refused before onboarding finishes', async () => {
  const res = await get('/brand/catalog', brandCookie);
  expect(res.statusCode).toBe(404);
  expect(res.json<{ code: string }>().code).toBe('not_found');
}, TIMEOUT);

test('a pasted positioning produces a valid ICP without touching the network', async () => {
  const res = await post(
    '/brand/icp/generate',
    {
      productUrl: 'https://loopwork.example.com',
      pastedPositioning:
        'Loopwork is interview scheduling and structured scorecards for talent teams. It removes coordination work between recruiters, hiring managers, and candidates. Buyers are heads of talent and recruiting operations leads at companies between 50 and 500 people who already run structured interviews but keep the structure in a spreadsheet. The buying trigger is a bad hire or a loop that ran past four weeks.'
    },
    brandCookie
  );

  expect(res.statusCode).toBe(200);
  const body = res.json<GenerateIcpResponse>();
  expect(body.source).toBe('pasted');
  expect(body.icp.sectors.length).toBeGreaterThan(0);
  expect(body.icp.sectors.length).toBeLessThanOrEqual(3);
  expect(body.icp.points.length).toBeGreaterThanOrEqual(3);
}, TIMEOUT);

test('saving the profile creates a workspace and returns the stored ICP', async () => {
  const res = await post(
    '/brand/profile',
    {
      companyName: 'Loopwork',
      productUrl: 'https://loopwork.example.com',
      icp: {
        summary:
          'Loopwork sells interview scheduling and structured scorecards to talent teams at companies between 50 and 500 people.',
        points: [
          'Companies between 50 and 500 people hiring 20 or more roles a year.',
          'Heads of talent and recruiting operations leads, not HR generalists.',
          'Already run structured interviews but keep the structure in a spreadsheet.',
          'Buying trigger is a bad hire or a loop that ran past four weeks.'
        ],
        buyerTitles: ['Head of Talent', 'Recruiting Operations Lead'],
        sectors: ['HR Tech', 'Recruiting', 'B2B SaaS']
      }
    },
    brandCookie
  );

  expect(res.statusCode).toBe(200);
  const body = res.json<BrandProfile>();
  expect(body.workspaceId).toMatch(/^[0-9a-f-]{36}$/);
  expect(body.icp.sectors).toEqual(['HR Tech', 'Recruiting', 'B2B SaaS']);
}, TIMEOUT);

test('the profile can be read back', async () => {
  const res = await get('/brand/profile', brandCookie);
  expect(res.statusCode).toBe(200);
  expect(res.json<BrandProfile>().companyName).toBe('Loopwork');
}, TIMEOUT);

test('the catalog ranks HR and recruiting creators above off-topic ones', async () => {
  const res = await get('/brand/catalog?view=matched&limit=24', brandCookie);
  expect(res.statusCode).toBe(200);

  const body = res.json<CatalogResponse>();
  expect(body.items.length).toBeGreaterThan(0);

  const names = body.items.map((i) => i.creator.name);
  expect(names).toContain('Amara Boateng');
  expect(names).toContain('Rachel Osei');
  expect(names).not.toContain('Tobias Lund');

  const scores = body.items.map((i) => i.match.score);
  expect([...scores].sort((a, b) => b - a)).toEqual(scores);
}, TIMEOUT);

test('every matched creator carries its component breakdown and a reason', async () => {
  const res = await get('/brand/catalog', brandCookie);
  const first = res.json<CatalogResponse>().items[0]!;

  expect(Object.keys(first.match.components).sort()).toEqual(
    ['audienceFit', 'availability', 'reliability', 'semanticFit', 'tagAffinity'].sort()
  );
  expect(first.match.reasons.length).toBeGreaterThan(0);
}, TIMEOUT);

test('browse-all returns more creators than the matched view', async () => {
  const matched = await get('/brand/catalog?view=matched', brandCookie);
  const all = await get('/brand/catalog?view=all', brandCookie);

  expect(all.json<CatalogResponse>().total).toBeGreaterThan(
    matched.json<CatalogResponse>().total
  );
}, TIMEOUT);

test('a creator with no delivery record is labelled as new', async () => {
  const res = await get('/brand/catalog?view=all&limit=100', brandCookie);
  const elias = res.json<CatalogResponse>().items.find((i) => i.creator.name === 'Elias Nordmark');

  expect(elias?.creator.deliveryRate).toBeNull();
  expect(elias?.match.reasons.some((r) => r.label.includes('New creator'))).toBe(true);
}, TIMEOUT);

test('a creator session cannot read the brand catalog', async () => {
  const signup = await post('/creator/signup', {
    email: `onb${stamp}c@constraint.test`,
    password: PASSWORD,
    name: 'Onboarding Creator'
  });
  const res = await get('/brand/catalog', cookieFrom(signup));
  expect(res.statusCode).toBe(403);
}, TIMEOUT);
