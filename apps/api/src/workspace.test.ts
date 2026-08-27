import { afterAll, beforeAll, expect, test } from 'bun:test';
import type { InvitePreview, Team, WorkspaceInvite } from '@lm/contracts';
import { users, workspaceInvites } from '@lm/db';
import { eq, like } from 'drizzle-orm';
import { buildApp } from './app';
import { db } from './auth';
import { issueInviteToken } from './invite-token';

const TIMEOUT = 60_000;
const app = buildApp();
const stamp = Date.now();
const PASSWORD = 'correct-horse-battery';

const OWNER_EMAIL = `wsowner${stamp}@constraint.test`;
const MATE_EMAIL = `wsmate${stamp}@constraint.test`;
const SECOND_EMAIL = `wssecond${stamp}@constraint.test`;
const CREATOR_EMAIL = `wscreator${stamp}@constraint.test`;

let ownerCookie = '';
let mateCookie = '';
let secondCookie = '';
let workspaceId = '';

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

async function signUp(side: 'brand' | 'creator', email: string, name: string) {
  const res = await post(`/${side}/signup`, { email, password: PASSWORD, name });
  expect(res.statusCode).toBeLessThan(400);
  return cookieFrom(res);
}

async function invite(email: string, role: 'admin' | 'member', cookie = ownerCookie) {
  return post('/brand/invites', { email, role }, cookie);
}

beforeAll(async () => {
  await app.ready();

  ownerCookie = await signUp('brand', OWNER_EMAIL, 'Workspace Owner');
  mateCookie = await signUp('brand', MATE_EMAIL, 'Workspace Mate');
  secondCookie = await signUp('brand', SECOND_EMAIL, 'Second Owner');
  await signUp('creator', CREATOR_EMAIL, 'Workspace Creator');

  const profile = await post(
    '/brand/profile',
    {
      companyName: 'Loopwork Workspaces',
      productUrl: 'https://loopwork.example.com',
      icp: {
        summary:
          'Loopwork sells interview scheduling and structured scorecards to talent teams at companies between 50 and 500 people.',
        points: [
          'Companies between 50 and 500 people hiring 20 or more roles a year.',
          'Heads of talent and recruiting operations leads, not HR generalists.',
          'Already run structured interviews but keep the structure in a spreadsheet.'
        ],
        buyerTitles: ['Head of Talent'],
        sectors: ['HR Tech', 'Recruiting', 'B2B SaaS']
      }
    },
    ownerCookie
  );
  expect(profile.statusCode).toBe(200);
  workspaceId = profile.json<{ workspaceId: string }>().workspaceId;
}, TIMEOUT);

afterAll(async () => {
  await db.delete(workspaceInvites).where(eq(workspaceInvites.workspaceId, workspaceId));
  await db.delete(users).where(like(users.email, 'ws%@constraint.test'));
  await app.close();
}, TIMEOUT);

test('the owner sees a team of one and no invites', async () => {
  const res = await get('/brand/team', ownerCookie);
  expect(res.statusCode).toBe(200);

  const team = res.json<Team>();
  expect(team.workspaceName).toBe('Loopwork Workspaces');
  expect(team.yourRole).toBe('owner');
  expect(team.members).toHaveLength(1);
  expect(team.members[0]!.email).toBe(OWNER_EMAIL);
  expect(team.invites).toHaveLength(0);
}, TIMEOUT);

test('a brand with no workspace is told to onboard rather than shown a team', async () => {
  const res = await get('/brand/team', mateCookie);
  expect(res.statusCode).toBe(404);
  expect(res.json<{ code: string }>().code).toBe('not_found');
}, TIMEOUT);

test('an invite cannot be sent to a creator account', async () => {
  const res = await invite(CREATOR_EMAIL, 'member');
  expect(res.statusCode).toBe(409);
  expect(res.json<{ code: string }>().code).toBe('email_belongs_to_other_account_type');
}, TIMEOUT);

test('an invite cannot be sent to someone already in the workspace', async () => {
  const res = await invite(OWNER_EMAIL, 'admin');
  expect(res.statusCode).toBe(409);
  expect(res.json<{ code: string }>().code).toBe('already_in_workspace');
}, TIMEOUT);

test('re-inviting the same email updates the pending invite instead of duplicating it', async () => {
  const first = await invite(MATE_EMAIL, 'member');
  expect(first.statusCode).toBe(200);

  const second = await invite(MATE_EMAIL, 'admin');
  expect(second.statusCode).toBe(200);
  expect(second.json<WorkspaceInvite>().id).toBe(first.json<WorkspaceInvite>().id);
  expect(second.json<WorkspaceInvite>().role).toBe('admin');

  const team = (await get('/brand/team', ownerCookie)).json<Team>();
  expect(team.invites).toHaveLength(1);
}, TIMEOUT);

test('the invite preview needs no session and names the workspace', async () => {
  const created = (await invite(MATE_EMAIL, 'member')).json<WorkspaceInvite>();
  const token = created.acceptUrl.split('/').pop()!;

  const res = await get(`/brand/invites/preview?token=${token}`);
  expect(res.statusCode).toBe(200);

  const preview = res.json<InvitePreview>();
  expect(preview.workspaceName).toBe('Loopwork Workspaces');
  expect(preview.email).toBe(MATE_EMAIL);
  expect(preview.role).toBe('member');
  expect(preview.invitedByName).toBe('Workspace Owner');
}, TIMEOUT);

test('a tampered or unsigned token is refused', async () => {
  const res = await get('/brand/invites/preview?token=not-a-real-token');
  expect(res.statusCode).toBe(404);
  expect(res.json<{ code: string }>().code).toBe('invalid_invite');
}, TIMEOUT);

test('an expired token is refused even though the row is still pending', async () => {
  const created = (await invite(MATE_EMAIL, 'member')).json<WorkspaceInvite>();
  const expired = issueInviteToken(created.id, new Date(Date.now() - 1_000));

  const res = await get(`/brand/invites/preview?token=${expired}`);
  expect(res.statusCode).toBe(404);
  expect(res.json<{ code: string }>().code).toBe('invalid_invite');
}, TIMEOUT);

test('an invite cannot be accepted by a different email', async () => {
  const created = (await invite(MATE_EMAIL, 'member')).json<WorkspaceInvite>();
  const token = created.acceptUrl.split('/').pop()!;

  const res = await post('/brand/invites/accept', { token }, secondCookie);
  expect(res.statusCode).toBe(403);
  expect(res.json<{ code: string }>().code).toBe('invalid_invite');
}, TIMEOUT);

test('accepting an invite joins the workspace at the invited role', async () => {
  const created = (await invite(MATE_EMAIL, 'member')).json<WorkspaceInvite>();
  const token = created.acceptUrl.split('/').pop()!;

  const res = await post('/brand/invites/accept', { token }, mateCookie);
  expect(res.statusCode).toBe(200);
  expect(res.json<{ workspaceId: string }>().workspaceId).toBe(workspaceId);

  const team = (await get('/brand/team', ownerCookie)).json<Team>();
  expect(team.members).toHaveLength(2);
  expect(team.members.find((m) => m.email === MATE_EMAIL)!.role).toBe('member');
  expect(team.invites).toHaveLength(0);
}, TIMEOUT);

test('an accepted invite cannot be replayed', async () => {
  const [row] = await db
    .select()
    .from(workspaceInvites)
    .where(eq(workspaceInvites.workspaceId, workspaceId))
    .limit(1);

  const res = await post(
    '/brand/invites/accept',
    { token: issueInviteToken(row!.id, row!.expiresAt) },
    secondCookie
  );
  expect(res.statusCode).toBe(404);
  expect(res.json<{ code: string }>().code).toBe('invalid_invite');
}, TIMEOUT);

test('a joined member reads the workspace campaigns, not their own empty set', async () => {
  const created = await post(
    '/brand/campaigns',
    {
      title: 'Workspace visibility',
      objective: 'Prove that a joined member sees the same campaigns as the owner.',
      keyMessages: [],
      doNot: [],
      deliverable: 'One LinkedIn post',
      budgetMinMinor: 10_000,
      budgetMaxMinor: 50_000,
      source: 'ai'
    },
    ownerCookie
  );
  expect(created.statusCode).toBe(200);

  const asMember = await get('/brand/campaigns', mateCookie);
  expect(asMember.statusCode).toBe(200);
  expect(
    asMember.json<{ items: { title: string }[] }>().items.some((c) => c.title === 'Workspace visibility')
  ).toBe(true);
}, TIMEOUT);

test('a member cannot invite anyone', async () => {
  const res = await invite(SECOND_EMAIL, 'member', mateCookie);
  expect(res.statusCode).toBe(403);
  expect(res.json<{ code: string }>().code).toBe('insufficient_role');
}, TIMEOUT);

test('a member cannot rewrite the workspace ICP', async () => {
  const res = await post(
    '/brand/profile',
    {
      companyName: 'Hijacked',
      productUrl: 'https://hijacked.example.com',
      icp: {
        summary:
          'A member should not be able to replace the ICP that every catalog ranking in the workspace depends on.',
        points: [
          'This request must be refused before the embedding call.',
          'The stored ICP must stay exactly as the owner left it.',
          'Only an owner or an admin may change it.'
        ],
        buyerTitles: ['Nobody'],
        sectors: ['B2B SaaS']
      }
    },
    mateCookie
  );
  expect(res.statusCode).toBe(403);
  expect(res.json<{ code: string }>().code).toBe('insufficient_role');
}, TIMEOUT);

test('the owner promotes a member to admin, who can then invite', async () => {
  const team = (await get('/brand/team', ownerCookie)).json<Team>();
  const mate = team.members.find((m) => m.email === MATE_EMAIL)!;

  const promoted = await post(`/brand/members/${mate.userId}/role`, { role: 'admin' }, ownerCookie);
  expect(promoted.statusCode).toBe(200);

  const sent = await invite(`wsguest${stamp}@constraint.test`, 'member', mateCookie);
  expect(sent.statusCode).toBe(200);
}, TIMEOUT);

test('an admin cannot change roles or remove people', async () => {
  const team = (await get('/brand/team', ownerCookie)).json<Team>();
  const owner = team.members.find((m) => m.email === OWNER_EMAIL)!;

  const demote = await post(`/brand/members/${owner.userId}/role`, { role: 'member' }, mateCookie);
  expect(demote.statusCode).toBe(403);
  expect(demote.json<{ code: string }>().code).toBe('insufficient_role');

  const remove = await post(`/brand/members/${owner.userId}/remove`, {}, mateCookie);
  expect(remove.statusCode).toBe(403);
}, TIMEOUT);

test('the owner cannot demote or remove themselves', async () => {
  const team = (await get('/brand/team', ownerCookie)).json<Team>();
  const owner = team.members.find((m) => m.email === OWNER_EMAIL)!;

  const demote = await post(`/brand/members/${owner.userId}/role`, { role: 'admin' }, ownerCookie);
  expect(demote.statusCode).toBe(403);

  const remove = await post(`/brand/members/${owner.userId}/remove`, {}, ownerCookie);
  expect(remove.statusCode).toBe(403);
}, TIMEOUT);

test('revoking a pending invite drops it from the team and kills the link', async () => {
  const team = (await get('/brand/team', ownerCookie)).json<Team>();
  const pending = team.invites[0]!;
  const token = pending.acceptUrl.split('/').pop()!;

  const revoked = await post(`/brand/invites/${pending.id}/revoke`, {}, ownerCookie);
  expect(revoked.statusCode).toBe(200);

  const again = await post(`/brand/invites/${pending.id}/revoke`, {}, ownerCookie);
  expect(again.statusCode).toBe(404);

  const preview = await get(`/brand/invites/preview?token=${token}`);
  expect(preview.statusCode).toBe(404);

  expect((await get('/brand/team', ownerCookie)).json<Team>().invites).toHaveLength(0);
}, TIMEOUT);

test('a brand that already owns a workspace cannot accept an invite into another', async () => {
  const created = (await invite(SECOND_EMAIL, 'member')).json<WorkspaceInvite>();
  const token = created.acceptUrl.split('/').pop()!;

  const ownProfile = await post(
    '/brand/profile',
    {
      companyName: 'Second Workspace',
      productUrl: 'https://second.example.com',
      icp: {
        summary:
          'Second Workspace sells contract review tooling to in-house legal teams at mid-market companies.',
        points: [
          'In-house legal teams of two to ten people.',
          'Already review contracts in email threads and shared drives.',
          'Buying trigger is a missed renewal or a failed audit.'
        ],
        buyerTitles: ['General Counsel'],
        sectors: ['Legal', 'B2B SaaS']
      }
    },
    secondCookie
  );
  expect(ownProfile.statusCode).toBe(200);

  const res = await post('/brand/invites/accept', { token }, secondCookie);
  expect(res.statusCode).toBe(409);
  expect(res.json<{ code: string }>().code).toBe('already_in_workspace');
}, TIMEOUT);

test('the owner removes a member, who loses the workspace entirely', async () => {
  const team = (await get('/brand/team', ownerCookie)).json<Team>();
  const mate = team.members.find((m) => m.email === MATE_EMAIL)!;

  const removed = await post(`/brand/members/${mate.userId}/remove`, {}, ownerCookie);
  expect(removed.statusCode).toBe(200);

  expect((await get('/brand/team', ownerCookie)).json<Team>().members).toHaveLength(1);
  expect((await get('/brand/campaigns', mateCookie)).statusCode).toBe(404);
}, TIMEOUT);
