import { afterAll, beforeAll, expect, test } from 'bun:test';
import { creators, escrowHolds, ledgerEntries, users, wallets, workspaces } from '@lm/db';
import { eq, like, sql } from 'drizzle-orm';
import { db } from '../auth';
import {
  creatorWallet,
  holdEscrow,
  InsufficientFunds,
  refundEscrow,
  releaseEscrow,
  topUp,
  withdraw,
  workspaceWallet
} from './ledger';
import { collaborations, campaigns, brands } from '@lm/db';

const TIMEOUT = 60_000;
const stamp = Date.now();

let workspaceId = '';
let creatorId = '';
let collaborationId = '';
let secondCollaborationId = '';

beforeAll(async () => {
  const [user] = await db
    .insert(users)
    .values({
      id: `led-${stamp}`,
      name: 'Ledger Creator',
      email: `led${stamp}@constraint.test`,
      accountType: 'creator'
    })
    .returning();

  const [workspace] = await db.insert(workspaces).values({ name: `Ledger ${stamp}` }).returning();
  workspaceId = workspace!.id;

  const [brand] = await db
    .insert(brands)
    .values({
      workspaceId,
      companyName: 'Ledgerworks',
      productUrl: `https://ledger${stamp}.example.com`,
      icpSummary: 'Sells scheduling to talent teams.',
      icpPoints: ['Fifty to five hundred people.', 'Talent leads.', 'Structured loops.'],
      buyerTitles: ['Head of Talent'],
      sectors: ['HR Tech']
    })
    .returning();

  const [creator] = await db
    .insert(creators)
    .values({
      userId: user!.id,
      profileUrl: `https://www.linkedin.com/in/led${stamp}`,
      name: 'Ledger Creator',
      topics: ['HR Tech'],
      ratePerPostMinor: 30_000
    })
    .returning();
  creatorId = creator!.id;

  const [campaign] = await db
    .insert(campaigns)
    .values({
      brandId: brand!.id,
      title: 'Ledger campaign',
      objective: 'Explain why a long loop costs more than a bad hire.',
      deliverable: 'One post.',
      budgetMinMinor: 10_000,
      budgetMaxMinor: 50_000,
      source: 'ai'
    })
    .returning();

  const [collaboration] = await db
    .insert(collaborations)
    .values({
      reference: `L-${stamp}`,
      campaignId: campaign!.id,
      creatorId,
      feeMinor: 30_000
    })
    .returning();
  collaborationId = collaboration!.id;

  const [secondCampaign] = await db
    .insert(campaigns)
    .values({
      brandId: brand!.id,
      title: 'Ledger campaign two',
      objective: 'Explain why a long loop costs more than a bad hire.',
      deliverable: 'One post.',
      budgetMinMinor: 10_000,
      budgetMaxMinor: 50_000,
      source: 'ai'
    })
    .returning();

  const [second] = await db
    .insert(collaborations)
    .values({
      reference: `L2-${stamp}`,
      campaignId: secondCampaign!.id,
      creatorId,
      feeMinor: 20_000
    })
    .returning();
  secondCollaborationId = second!.id;
}, TIMEOUT);

afterAll(async () => {
  await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
  await db.delete(users).where(like(users.email, 'led%@constraint.test'));
}, TIMEOUT);

const balanceOf = async (walletId: string) => {
  const [row] = await db
    .select({ balanceMinor: wallets.balanceMinor })
    .from(wallets)
    .where(eq(wallets.id, walletId))
    .limit(1);
  return row!.balanceMinor;
};

test('a top-up credits the workspace and debits the platform', async () => {
  const balance = await db.transaction((tx) => topUp(tx, { workspaceId, amountMinor: 100_000 }));
  expect(balance).toBe(100_000);
}, TIMEOUT);

test('a hold moves money out of the workspace wallet and into escrow', async () => {
  const before = await db.transaction(async (tx) => balanceOf((await workspaceWallet(tx, workspaceId)).id));

  const hold = await db.transaction((tx) =>
    holdEscrow(tx, { collaborationId, workspaceId, amountMinor: 30_000 })
  );

  expect(hold.state).toBe('held');
  expect(hold.amountMinor).toBe(30_000);

  const after = await db.transaction(async (tx) => balanceOf((await workspaceWallet(tx, workspaceId)).id));
  expect(before - after).toBe(30_000);
}, TIMEOUT);

test('holding twice for one collaboration moves money once', async () => {
  const before = await db.transaction(async (tx) => balanceOf((await workspaceWallet(tx, workspaceId)).id));

  await db.transaction((tx) => holdEscrow(tx, { collaborationId, workspaceId, amountMinor: 30_000 }));

  const after = await db.transaction(async (tx) => balanceOf((await workspaceWallet(tx, workspaceId)).id));
  expect(after).toBe(before);

  const rows = await db
    .select()
    .from(escrowHolds)
    .where(eq(escrowHolds.collaborationId, collaborationId));
  expect(rows).toHaveLength(1);
}, TIMEOUT);

test('a release pays the creator and closes the hold', async () => {
  await db.transaction((tx) => releaseEscrow(tx, { collaborationId, creatorId }));

  const earned = await db.transaction(async (tx) => balanceOf((await creatorWallet(tx, creatorId)).id));
  expect(earned).toBe(30_000);

  const [hold] = await db
    .select()
    .from(escrowHolds)
    .where(eq(escrowHolds.collaborationId, collaborationId));
  expect(hold!.state).toBe('released');
  expect(hold!.settledAt).not.toBeNull();
}, TIMEOUT);

test('releasing a closed hold a second time moves nothing', async () => {
  const before = await db.transaction(async (tx) => balanceOf((await creatorWallet(tx, creatorId)).id));
  const result = await db.transaction((tx) => releaseEscrow(tx, { collaborationId, creatorId }));

  expect(result).toBeNull();
  const after = await db.transaction(async (tx) => balanceOf((await creatorWallet(tx, creatorId)).id));
  expect(after).toBe(before);
}, TIMEOUT);

test('a refund returns the money to the workspace that committed it', async () => {
  await db.transaction((tx) =>
    holdEscrow(tx, {
      collaborationId: secondCollaborationId,
      workspaceId,
      amountMinor: 20_000
    })
  );

  const held = await db.transaction(async (tx) => balanceOf((await workspaceWallet(tx, workspaceId)).id));
  await db.transaction((tx) => refundEscrow(tx, { collaborationId: secondCollaborationId }));
  const refunded = await db.transaction(async (tx) => balanceOf((await workspaceWallet(tx, workspaceId)).id));

  expect(refunded - held).toBe(20_000);
}, TIMEOUT);

test('a wallet cannot spend what it does not have', async () => {
  let thrown: unknown;
  try {
    await db.transaction((tx) => withdraw(tx, { creatorId, amountMinor: 999_999_999 }));
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(InsufficientFunds);
  expect((thrown as InsufficientFunds).status).toBe(402);

  const balance = await db.transaction(async (tx) => balanceOf((await creatorWallet(tx, creatorId)).id));
  expect(balance).toBe(30_000);
}, TIMEOUT);

test('a withdrawal takes the money out of the system', async () => {
  const balance = await db.transaction((tx) => withdraw(tx, { creatorId, amountMinor: 30_000 }));
  expect(balance).toBe(0);
}, TIMEOUT);

test('every entry group is a balanced pair', async () => {
  const rows = await db
    .select({
      entryGroup: ledgerEntries.entryGroup,
      sides: sql<number>`count(*)::int`,
      total: sql<number>`sum(${ledgerEntries.amountMinor})::int`
    })
    .from(ledgerEntries)
    .groupBy(ledgerEntries.entryGroup);

  expect(rows.length).toBeGreaterThan(0);
  expect(rows.filter((row) => row.sides > 2)).toEqual([]);
  expect(rows.filter((row) => row.sides === 2 && row.total !== 0)).toEqual([]);
}, TIMEOUT);

test('a movement writes both sides or neither', async () => {
  const [before] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ledgerEntries);

  let failed = false;
  try {
    await db.transaction(async (tx) => {
      await topUp(tx, { workspaceId, amountMinor: 5_000 });
      throw new Error('rolled back on purpose');
    });
  } catch {
    failed = true;
  }

  const [after] = await db.select({ count: sql<number>`count(*)::int` }).from(ledgerEntries);

  expect(failed).toBe(true);
  expect(after!.count).toBe(before!.count);
}, TIMEOUT);

test('every wallet balance equals the sum of its entries', async () => {
  const rows = await db
    .select({
      walletId: wallets.id,
      balanceMinor: wallets.balanceMinor,
      entered: sql<number>`coalesce(sum(${ledgerEntries.amountMinor}), 0)::int`
    })
    .from(wallets)
    .leftJoin(ledgerEntries, eq(ledgerEntries.walletId, wallets.id))
    .groupBy(wallets.id, wallets.balanceMinor);

  expect(rows.length).toBeGreaterThan(0);
  expect(rows.filter((row) => row.balanceMinor !== row.entered)).toEqual([]);
}, TIMEOUT);
