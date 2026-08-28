// Seeds real, constraint-valid activity for the creator "Bill Gates"
// (lothr1731@gmail.com) so the creator dashboard shows earnings, pipeline, and a
// delivery record instead of zeros. Idempotent for this creator.
import { eq, inArray } from 'drizzle-orm';
import { createDb, createPool } from './client';
import { collaborations, creators, escrowHolds, ledgerEntries, linkClicks, wallets } from './schema';

const CREATOR_ID = '635a2b23-e36e-44e3-84bc-dabd3989efad';
const WORKSPACE_ID = 'db6e5fad-9bc6-4532-af5f-2f7c89bc795d';
const CAMPAIGN = {
  ats: '831d12da-c71d-4f84-9b1e-246be77c967e',
  resume: '6aaefaed-c12d-4440-93a9-e98ef81f4581',
  recruiter: 'c085e5b1-cff8-4e55-a226-9edcbdcd4d94'
};

let seed = 0x51c0de7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000);
const pick = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
const now = Date.now();
const daysAgo = (d: number) => new Date(now - d * 86_400_000);
const dateStr = (d: Date) => d.toISOString().slice(0, 10);

const LIVE = [
  { campaign: CAMPAIGN.ats, ref: 'BG-0001', fee: 34_000, state: 'paid', ageDays: 30, hits: 44 },
  { campaign: CAMPAIGN.resume, ref: 'BG-0002', fee: 34_000, state: 'verified', ageDays: 18, hits: 27 },
  { campaign: CAMPAIGN.recruiter, ref: 'BG-0003', fee: 38_000, state: 'published', ageDays: 9, hits: 15 }
] as const;

// historical payouts (no collaboration attached), spread over half a year
const HISTORY = [
  { at: 165, amount: 42_000 },
  { at: 128, amount: 51_000 },
  { at: 96, amount: 38_000 },
  { at: 61, amount: 46_000 },
  { at: 34, amount: 34_000 }
];
const WITHDRAWALS = [{ at: 80, amount: 120_000 }];

const pool = createPool();
const db = createDb(pool);

try {
  // wipe this creator's live collaborations (cascades holds, clicks, messages)
  const mine = await db
    .select({ id: collaborations.id })
    .from(collaborations)
    .where(eq(collaborations.creatorId, CREATOR_ID));
  if (mine.length > 0) {
    await db.delete(collaborations).where(
      inArray(
        collaborations.id,
        mine.map((r) => r.id)
      )
    );
  }

  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.creatorId, CREATOR_ID))
    .limit(1);
  const walletId = wallet
    ? wallet.id
    : (
        await db
          .insert(wallets)
          .values({ owner: 'creator', creatorId: CREATOR_ID })
          .returning()
      )[0]!.id;
  await db.delete(ledgerEntries).where(eq(ledgerEntries.walletId, walletId));

  const releasedGroups: { entryGroup: string; walletId: string; kind: 'release' | 'withdraw'; amountMinor: number; collaborationId: string | null; createdAt: Date }[] =
    [];

  for (const c of LIVE) {
    const invitedAt = daysAgo(c.ageDays + 12);
    const published = ['published', 'verified', 'paid'].includes(c.state);
    const paid = c.state === 'paid';

    const [row] = await db
      .insert(collaborations)
      .values({
        reference: c.ref,
        campaignId: c.campaign,
        creatorId: CREATOR_ID,
        state: c.state as (typeof collaborations.$inferInsert)['state'],
        feeMinor: c.fee,
        counterRounds: 0,
        trackedLink: published ? `https://lw.link/${c.ref}` : null,
        postUrl: published ? 'https://www.linkedin.com/posts/activity-1' : null,
        publishBy: new Date(invitedAt.getTime() + 9 * 86_400_000),
        invitedAt,
        respondedAt: new Date(invitedAt.getTime() + 3_600_000),
        publishedAt: published ? daysAgo(c.ageDays) : null,
        verifiedAt: c.state === 'verified' || paid ? daysAgo(c.ageDays - 2) : null,
        updatedAt: invitedAt
      })
      .returning();

    await db.insert(escrowHolds).values({
      collaborationId: row!.id,
      workspaceId: WORKSPACE_ID,
      amountMinor: c.fee,
      state: paid ? 'released' : 'held',
      createdAt: new Date(invitedAt.getTime() + 3_600_000),
      settledAt: paid ? daysAgo(c.ageDays - 3) : null
    });

    if (paid) {
      releasedGroups.push({
        entryGroup: crypto.randomUUID(),
        walletId,
        kind: 'release',
        amountMinor: c.fee,
        collaborationId: row!.id,
        createdAt: daysAgo(c.ageDays - 3)
      });
    }

    // clicks for anything that reached published
    if (published) {
      let remaining = c.hits;
      const rows: (typeof linkClicks.$inferInsert)[] = [];
      let v = 0;
      while (remaining > 0) {
        const hits = Math.min(remaining, pick(1, 3));
        remaining -= hits;
        rows.push({
          collaborationId: row!.id,
          visitorHash: `${c.ref}-v${v++}`,
          clickedOn: dateStr(daysAgo(pick(1, c.ageDays))),
          hits,
          firstAt: invitedAt,
          lastAt: invitedAt
        });
      }
      await db.insert(linkClicks).values(rows);
    }
  }

  for (const h of HISTORY) {
    releasedGroups.push({
      entryGroup: crypto.randomUUID(),
      walletId,
      kind: 'release',
      amountMinor: h.amount,
      collaborationId: null,
      createdAt: daysAgo(h.at)
    });
  }
  for (const w of WITHDRAWALS) {
    releasedGroups.push({
      entryGroup: crypto.randomUUID(),
      walletId,
      kind: 'withdraw',
      amountMinor: -w.amount,
      collaborationId: null,
      createdAt: daysAgo(w.at)
    });
  }

  await db.insert(ledgerEntries).values(releasedGroups);

  const balance = releasedGroups.reduce((sum, e) => sum + e.amountMinor, 0);
  await db.update(wallets).set({ balanceMinor: balance }).where(eq(wallets.id, walletId));

  // delivery record: past history plus the three live ones
  await db
    .update(creators)
    .set({ acceptedCount: 15, deliveredCount: 13 })
    .where(eq(creators.id, CREATOR_ID));

  console.log(
    `populated Bill Gates: ${LIVE.length} live collaborations, ${HISTORY.length} historical payouts, wallet ${balance / 100}`
  );
} finally {
  await pool.end();
}
