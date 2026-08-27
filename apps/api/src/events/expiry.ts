import { transition, type Collaboration } from '@lm/collab';
import type { CollabState } from '@lm/contracts';
import { campaigns, collaborationEvents, collaborations, creators } from '@lm/db';
import { and, eq, inArray, isNotNull, lt, or, sql } from 'drizzle-orm';
import { db } from '../auth';
import { refundEscrow, releaseEscrow } from '../billing/ledger';
import { publishCollabChange, type StatusBus } from './bus';

export const RESPONSE_WINDOW_MS = 72 * 60 * 60 * 1000;
export const VERIFY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const SETTLE_WINDOW_MS = 48 * 60 * 60 * 1000;
export const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

const AWAITING_RESPONSE: CollabState[] = ['invited', 'countered'];

const AWAITING_PUBLICATION: CollabState[] = [
  'accepted',
  'brief_shared',
  'draft_submitted',
  'revision_requested',
  'draft_approved',
  'scheduled'
];

export type Expiry = {
  collaborationId: string;
  reference: string;
  from: CollabState;
  reason: 'no_response' | 'not_published';
  refunded: boolean;
};

export async function sweepExpiries(bus: StatusBus, now = new Date()): Promise<Expiry[]> {
  const due = await db
    .select({ collaboration: collaborations, brandId: campaigns.brandId })
    .from(collaborations)
    .innerJoin(campaigns, eq(collaborations.campaignId, campaigns.id))
    .where(
      or(
        and(
          inArray(collaborations.state, AWAITING_RESPONSE),
          lt(collaborations.invitedAt, new Date(now.getTime() - RESPONSE_WINDOW_MS))
        ),
        and(
          inArray(collaborations.state, AWAITING_PUBLICATION),
          isNotNull(collaborations.publishBy),
          lt(collaborations.publishBy, now)
        )
      )
    );

  const expired: Expiry[] = [];

  for (const { collaboration, brandId } of due) {
    const outcome = transition(snapshotOf(collaboration), { event: 'expire', actor: 'system' });
    if (!outcome.ok) continue;

    const refunded = outcome.effects.includes('refund_escrow');

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(collaborations)
        .set({ state: outcome.to, updatedAt: now })
        .where(and(eq(collaborations.id, collaboration.id), eq(collaborations.state, collaboration.state)))
        .returning();

      if (!row) return null;

      await tx.insert(collaborationEvents).values({
        collaborationId: row.id,
        event: 'expire',
        actor: 'system',
        actorUserId: null,
        fromState: collaboration.state,
        toState: outcome.to,
        payload: { effects: outcome.effects, deadline: deadlineOf(collaboration, now) }
      });

      if (refunded) await refundEscrow(tx, { collaborationId: row.id });

      return row;
    });

    if (!updated) continue;

    await publishCollabChange(bus, {
      row: updated,
      brandId,
      from: collaboration.state,
      to: outcome.to,
      actor: 'system'
    });

    expired.push({
      collaborationId: updated.id,
      reference: updated.reference,
      from: collaboration.state,
      reason: AWAITING_RESPONSE.includes(collaboration.state) ? 'no_response' : 'not_published',
      refunded
    });
  }

  return expired;
}

export type Settlement = {
  collaborationId: string;
  reference: string;
  event: 'verify' | 'pay';
  amountMinor: number | null;
};

export async function sweepSettlement(bus: StatusBus, now = new Date()): Promise<Settlement[]> {
  const due = await db
    .select({ collaboration: collaborations, brandId: campaigns.brandId })
    .from(collaborations)
    .innerJoin(campaigns, eq(collaborations.campaignId, campaigns.id))
    .where(
      or(
        and(
          eq(collaborations.state, 'published'),
          isNotNull(collaborations.publishedAt),
          lt(collaborations.publishedAt, new Date(now.getTime() - VERIFY_WINDOW_MS))
        ),
        and(
          eq(collaborations.state, 'verified'),
          isNotNull(collaborations.verifiedAt),
          lt(collaborations.verifiedAt, new Date(now.getTime() - SETTLE_WINDOW_MS))
        )
      )
    );

  const settled: Settlement[] = [];

  for (const { collaboration, brandId } of due) {
    const event = collaboration.state === 'published' ? 'verify' : 'pay';
    const outcome = transition(snapshotOf(collaboration), { event, actor: 'system' });
    if (!outcome.ok) continue;

    const result = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(collaborations)
        .set({
          state: outcome.to,
          verifiedAt: outcome.to === 'verified' ? now : collaboration.verifiedAt,
          updatedAt: now
        })
        .where(
          and(eq(collaborations.id, collaboration.id), eq(collaborations.state, collaboration.state))
        )
        .returning();

      if (!row) return null;

      await tx.insert(collaborationEvents).values({
        collaborationId: row.id,
        event,
        actor: 'system',
        actorUserId: null,
        fromState: collaboration.state,
        toState: outcome.to,
        payload: { effects: outcome.effects, automatic: true }
      });

      if (outcome.effects.includes('count_delivery')) {
        await tx
          .update(creators)
          .set({ deliveredCount: sql`${creators.deliveredCount} + 1` })
          .where(eq(creators.id, row.creatorId));
      }

      const released = outcome.effects.includes('release_escrow')
        ? await releaseEscrow(tx, { collaborationId: row.id, creatorId: row.creatorId })
        : null;

      return { row, releasedMinor: released?.amountMinor ?? null };
    });

    if (!result) continue;

    await publishCollabChange(bus, {
      row: result.row,
      brandId,
      from: collaboration.state,
      to: outcome.to,
      actor: 'system'
    });

    settled.push({
      collaborationId: result.row.id,
      reference: result.row.reference,
      event,
      amountMinor: result.releasedMinor
    });
  }

  return settled;
}

export function startSweeps(bus: StatusBus) {
  const timer = setInterval(() => {
    void sweepExpiries(bus).catch(() => undefined);
    void sweepSettlement(bus).catch(() => undefined);
  }, SWEEP_INTERVAL_MS);
  timer.unref?.();
  return () => clearInterval(timer);
}

type Row = typeof collaborations.$inferSelect;

function snapshotOf(row: Row): Collaboration {
  return {
    state: row.state,
    counterRounds: row.counterRounds,
    trackedLink: row.trackedLink,
    postUrl: row.postUrl,
    lastCounterBy: row.lastCounterBy
  };
}

function deadlineOf(row: Row, now: Date) {
  if (AWAITING_RESPONSE.includes(row.state)) {
    return new Date(row.invitedAt.getTime() + RESPONSE_WINDOW_MS).toISOString();
  }
  return (row.publishBy ?? now).toISOString();
}
