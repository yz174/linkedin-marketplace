// Populates real, constraint-valid records for the "sureshortlist" brand so the
// dashboard, charts, catalog, collaborations, messenger, and billing screens show
// coherent data instead of zeros. Idempotent: wipes this brand's campaigns first.
import { eq, inArray } from 'drizzle-orm';
import { createDb, createPool } from './client';
import {
  campaigns,
  collaborations,
  escrowHolds,
  ledgerEntries,
  linkClicks,
  messages,
  wallets
} from './schema';

const WORKSPACE_ID = 'db6e5fad-9bc6-4532-af5f-2f7c89bc795d';
const BRAND_ID = '5d3cebf4-133b-4477-8725-d2933fb0189a';
const BRAND_USER = '683847db-ed6e-4ca2-b17c-f63360c7e073';

const CREATOR = {
  amara: '70c0c2b6-8817-4e08-9431-21456d67cb8e',
  rachel: 'c7bd8346-26c7-4f59-92cd-bffbf6a431ff',
  elias: 'f4be49d6-b71a-41b4-83bc-d0901daf6bd3',
  priya: '6a06474c-e658-4d54-861d-3d81f7204437',
  lea: '76b636d4-7ed9-4e44-bae7-2adee31b1d62',
  marcus: 'b0f5df3a-350d-4151-9701-29637525b70a',
  tomas: 'bdd9968a-8489-46b2-84bd-3497f6f7e638'
} as const;

// deterministic LCG so re-runs produce identical data
let seed = 0x2f6e1a3;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000);
const pick = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));

const now = Date.now();
const daysAgo = (d: number) => new Date(now - d * 86_400_000);
const dateStr = (d: Date) => d.toISOString().slice(0, 10);

const CAMPAIGNS = [
  {
    title: 'ATS parsing awareness',
    objective:
      'A job seeker should know a parser reads the resume before any person does, and that a clean parse is what gets it in front of the recruiter.',
    keyMessages: [
      'Most applications are filtered by a parser, not rejected by a person.',
      'Two column layouts and text in headers are where parsers drop content.',
      'You can check how your resume parses before you apply.'
    ],
    doNot: [
      'Do not open by naming the product.',
      'Do not claim a specific rejection percentage the page does not support.',
      'Do not imply recruiters never read resumes.'
    ],
    deliverable: 'One LinkedIn post of 150 to 220 words carrying a tracked link.',
    budgetMinMinor: 15_000,
    budgetMaxMinor: 40_000
  },
  {
    title: 'Resume tailoring workflow',
    objective:
      'Tailoring a resume to each posting beats sending one generic version, and it takes minutes once the keyword gaps are visible.',
    keyMessages: [
      'A generic resume competes on volume, a tailored one competes on fit.',
      'The gap between your resume and the job description is measurable.',
      'Rewriting duty led bullets into outcomes keeps the facts and adds the signal.'
    ],
    doNot: [
      'Do not start from a feature list.',
      'Do not promise interviews.',
      'Do not use the word effortless.'
    ],
    deliverable: 'One LinkedIn post of 160 to 240 words with a tracked link.',
    budgetMinMinor: 20_000,
    budgetMaxMinor: 45_000
  },
  {
    title: 'Recruiter POV on formatting',
    objective:
      'What makes a resume easy to shortlist from a recruiter chair: contact block that parses, dates that line up, bullets that answer "so what".',
    keyMessages: [
      'A recruiter scans, so structure decides whether the content is even seen.',
      'Dates and section headings are the first thing a parser mangles.',
      'One document should export to PDF, DOCX, and TXT without breaking.'
    ],
    doNot: [
      'Do not moralise about candidates.',
      'Do not overstate how long a recruiter spends per resume.',
      'Do not open from the product.'
    ],
    deliverable: 'One LinkedIn post of 150 to 230 words with a tracked link.',
    budgetMinMinor: 18_000,
    budgetMaxMinor: 50_000
  }
] as const;

type Booking = {
  campaign: number;
  creator: string;
  fee: number;
  state: string;
  counterFee?: number;
  rounds?: number;
  lastCounterBy?: 'brand' | 'creator';
  draft?: string;
  clickTargetHits?: number;
};

const BOOKINGS: Booking[] = [
  { campaign: 0, creator: CREATOR.amara, fee: 21_000, state: 'paid', clickTargetHits: 34 },
  { campaign: 0, creator: CREATOR.rachel, fee: 37_000, state: 'verified', clickTargetHits: 26 },
  { campaign: 0, creator: CREATOR.marcus, fee: 18_000, state: 'published', clickTargetHits: 12 },
  { campaign: 0, creator: CREATOR.elias, fee: 12_000, state: 'invited' },
  { campaign: 1, creator: CREATOR.priya, fee: 34_000, state: 'paid', clickTargetHits: 41 },
  {
    campaign: 1,
    creator: CREATOR.lea,
    fee: 28_000,
    state: 'draft_submitted',
    draft:
      'Last touch attribution survives because it is the one model nobody has to defend in a meeting. Your resume has the same problem. A recruiter sees the last version, the parser saw the first. Here is what changed when I ran mine through a parser check before applying...'
  },
  { campaign: 1, creator: CREATOR.rachel, fee: 37_000, state: 'accepted' },
  {
    campaign: 1,
    creator: CREATOR.marcus,
    fee: 18_000,
    state: 'countered',
    counterFee: 22_000,
    rounds: 1,
    lastCounterBy: 'creator'
  },
  { campaign: 2, creator: CREATOR.amara, fee: 21_000, state: 'published', clickTargetHits: 17 },
  { campaign: 2, creator: CREATOR.priya, fee: 34_000, state: 'scheduled' },
  { campaign: 2, creator: CREATOR.elias, fee: 12_000, state: 'declined' },
  { campaign: 2, creator: CREATOR.tomas, fee: 48_000, state: 'brief_shared' }
];

const HELD = new Set([
  'accepted',
  'brief_shared',
  'draft_submitted',
  'revision_requested',
  'draft_approved',
  'scheduled',
  'published',
  'verified'
]);
const PUBLISHED = new Set(['published', 'verified', 'paid']);
const TOPUP = 500_000;

const pool = createPool();
const db = createDb(pool);

try {
  // wipe this brand's campaigns (cascades collaborations -> holds, clicks, messages, events)
  const existing = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(eq(campaigns.brandId, BRAND_ID));
  if (existing.length > 0) {
    await db.delete(campaigns).where(
      inArray(
        campaigns.id,
        existing.map((c) => c.id)
      )
    );
  }

  // fresh workspace wallet + ledger
  const [existingWallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.workspaceId, WORKSPACE_ID))
    .limit(1);
  if (existingWallet) {
    await db.delete(ledgerEntries).where(eq(ledgerEntries.walletId, existingWallet.id));
    await db.delete(wallets).where(eq(wallets.id, existingWallet.id));
  }

  const campaignIds: string[] = [];
  for (const c of CAMPAIGNS) {
    const [row] = await db
      .insert(campaigns)
      .values({
        brandId: BRAND_ID,
        title: c.title,
        objective: c.objective,
        keyMessages: [...c.keyMessages],
        doNot: [...c.doNot],
        deliverable: c.deliverable,
        budgetMinMinor: c.budgetMinMinor,
        budgetMaxMinor: c.budgetMaxMinor,
        source: 'ai',
        landingUrl: 'https://sureshortlist.com',
        createdAt: daysAgo(56)
      })
      .returning({ id: campaigns.id });
    campaignIds.push(row!.id);
  }

  const [wallet] = await db
    .insert(wallets)
    .values({ owner: 'workspace', workspaceId: WORKSPACE_ID, balanceMinor: 0 })
    .returning();

  const ledger: { entryGroup: string; walletId: string; kind: 'topup' | 'hold'; amountMinor: number; createdAt: Date }[] =
    [
      {
        entryGroup: crypto.randomUUID(),
        walletId: wallet!.id,
        kind: 'topup',
        amountMinor: TOPUP,
        createdAt: daysAgo(55)
      }
    ];
  let walletBalance = TOPUP;

  const IN_PRODUCTION = new Set(['accepted', 'brief_shared', 'draft_submitted', 'revision_requested', 'draft_approved', 'scheduled']);

  let ref = 1;
  let clickIdx = 0;
  for (let i = 0; i < BOOKINGS.length; i++) {
    const b = BOOKINGS[i]!;
    // keep publish-by in the future for anything still in production so the
    // expiry sweep does not eat these; published states sit further back.
    const invitedAt = PUBLISHED.has(b.state)
      ? daysAgo(pick(22, 44))
      : b.state === 'declined'
        ? daysAgo(pick(9, 20))
        : IN_PRODUCTION.has(b.state)
          ? daysAgo(pick(3, 11))
          : daysAgo(pick(1, 6));
    const agreedFee = b.counterFee ?? b.fee;

    const [collab] = await db
      .insert(collaborations)
      .values({
        reference: `SS-${String(ref++).padStart(4, '0')}`,
        campaignId: campaignIds[b.campaign]!,
        creatorId: b.creator,
        state: b.state as (typeof collaborations.$inferInsert)['state'],
        feeMinor: b.fee,
        counterFeeMinor: b.counterFee ?? null,
        counterRounds: b.rounds ?? 0,
        lastCounterBy: b.lastCounterBy ?? null,
        draft: b.draft ?? null,
        trackedLink: PUBLISHED.has(b.state) ? `https://lw.link/SS-${String(ref - 1).padStart(4, '0')}` : null,
        postUrl: PUBLISHED.has(b.state) ? 'https://www.linkedin.com/posts/activity-1' : null,
        publishBy: PUBLISHED.has(b.state)
          ? new Date(invitedAt.getTime() + 9 * 86_400_000)
          : HELD.has(b.state)
            ? new Date(now + pick(4, 12) * 86_400_000)
            : null,
        invitedAt,
        respondedAt: b.state === 'invited' ? null : new Date(invitedAt.getTime() + 3_600_000),
        publishedAt: PUBLISHED.has(b.state) ? new Date(invitedAt.getTime() + 9 * 86_400_000) : null,
        verifiedAt:
          b.state === 'verified' || b.state === 'paid'
            ? new Date(invitedAt.getTime() + 11 * 86_400_000)
            : null,
        updatedAt: invitedAt
      })
      .returning();

    // escrow hold
    if (HELD.has(b.state) || b.state === 'paid') {
      const released = b.state === 'paid';
      await db.insert(escrowHolds).values({
        collaborationId: collab!.id,
        workspaceId: WORKSPACE_ID,
        amountMinor: agreedFee,
        state: released ? 'released' : 'held',
        createdAt: new Date(invitedAt.getTime() + 3_600_000),
        settledAt: released ? new Date(invitedAt.getTime() + 13 * 86_400_000) : null
      });
      ledger.push({
        entryGroup: crypto.randomUUID(),
        walletId: wallet!.id,
        kind: 'hold',
        amountMinor: -agreedFee,
        createdAt: new Date(invitedAt.getTime() + 3_600_000)
      });
      walletBalance -= agreedFee;
    }

    // link clicks for published+
    if (b.clickTargetHits && PUBLISHED.has(b.state)) {
      let remaining = b.clickTargetHits;
      const rows: (typeof linkClicks.$inferInsert)[] = [];
      while (remaining > 0) {
        const hits = Math.min(remaining, pick(1, 3));
        remaining -= hits;
        rows.push({
          collaborationId: collab!.id,
          visitorHash: `v${clickIdx++}`,
          clickedOn: dateStr(daysAgo(pick(1, 26))),
          hits,
          firstAt: invitedAt,
          lastAt: invitedAt
        });
      }
      // dedupe (collab, visitor, day) is guaranteed unique by visitorHash being unique per row
      await db.insert(linkClicks).values(rows);
    }

    // a short thread on the ones that are mid-negotiation or in production
    if (['countered', 'accepted', 'draft_submitted'].includes(b.state)) {
      const thread =
        b.state === 'countered'
          ? [
              { sender: 'brand' as const, body: 'Offer is 18000 for one post with a tracked link, publish within two weeks of the brief.' },
              { sender: 'creator' as const, body: 'I can do it at 22000. This is a niche cut and I turn these around fast.' }
            ]
          : b.state === 'accepted'
            ? [
                { sender: 'brand' as const, body: 'Accepted. Brief is attached, tracked link comes on draft approval.' },
                { sender: 'creator' as const, body: 'Got it. Draft with you in three days.' }
              ]
            : [
                { sender: 'brand' as const, body: 'Brief shared, take the angle you think lands.' },
                { sender: 'creator' as const, body: 'Draft submitted. Kept the facts, reframed the bullets around outcomes.' }
              ];
      let seq = 0;
      for (const m of thread) {
        seq += 1;
        await db.insert(messages).values({
          id: crypto.randomUUID(),
          collaborationId: collab!.id,
          seq,
          sender: m.sender,
          body: m.body,
          createdAt: new Date(invitedAt.getTime() + seq * 3_600_000)
        });
      }
      await db.update(collaborations).set({ messageSeq: seq }).where(eq(collaborations.id, collab!.id));
    }
  }

  await db.insert(ledgerEntries).values(ledger);
  await db.update(wallets).set({ balanceMinor: walletBalance }).where(eq(wallets.id, wallet!.id));

  console.log(
    `populated: ${CAMPAIGNS.length} campaigns, ${BOOKINGS.length} collaborations, wallet balance ${walletBalance / 100}`
  );
} finally {
  await pool.end();
}
