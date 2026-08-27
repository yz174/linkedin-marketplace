import { transition, type Collaboration } from '@lm/collab';
import type { CollabState } from '@lm/contracts';
import { campaigns, collaborationEvents, collaborations } from '@lm/db';
import { and, eq, inArray, isNotNull, lt, or } from 'drizzle-orm';
import { db } from '../auth';
import { publishCollabChange, type StatusBus } from './bus';

export const RESPONSE_WINDOW_MS = 72 * 60 * 60 * 1000;
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

export function startExpirySweep(bus: StatusBus) {
  const timer = setInterval(() => {
    void sweepExpiries(bus).catch(() => undefined);
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
