import { CollabEvent, type Actor } from '@lm/contracts';
import { transition, type Collaboration } from '@lm/collab';
import { brands, campaigns, collaborationEvents, collaborations, creators } from '@lm/db';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../auth';
import { session } from '../guards';
import { HttpError } from '../http';
import { existingWorkspace } from './brand-routes';

const Move = z.object({
  event: CollabEvent,
  feeMinor: z.number().int().min(0).optional(),
  draft: z.string().trim().max(8000).optional(),
  postUrl: z.string().url().optional()
});

const Invite = z.object({
  campaignId: z.string().uuid(),
  creatorId: z.string().uuid(),
  feeMinor: z.number().int().min(0),
  publishBy: z.string().datetime().optional()
});

export function collabRoutes(instance: FastifyInstance, actor: Extract<Actor, 'brand' | 'creator'>) {
  const app = instance.withTypeProvider<ZodTypeProvider>();

  app.get('/collaborations', async (request) => {
    const rows = await visibleTo(actor, session(request).userId);
    return { items: rows };
  });

  if (actor === 'brand') {
    app.post('/collaborations', { schema: { body: Invite } }, async (request) => {
      const userId = session(request).userId;
      const brand = await brandFor(userId);

      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(and(eq(campaigns.id, request.body.campaignId), eq(campaigns.brandId, brand.id)))
        .limit(1);
      if (!campaign) throw new HttpError(404, 'not_found', 'No such campaign.');

      const [creator] = await db
        .select()
        .from(creators)
        .where(eq(creators.id, request.body.creatorId))
        .limit(1);
      if (!creator) throw new HttpError(404, 'not_found', 'No such creator.');

      const [row] = await db
        .insert(collaborations)
        .values({
          reference: reference(),
          campaignId: campaign.id,
          creatorId: creator.id,
          feeMinor: request.body.feeMinor,
          publishBy: request.body.publishBy ? new Date(request.body.publishBy) : null
        })
        .returning();

      await db.insert(collaborationEvents).values({
        collaborationId: row!.id,
        event: 'accept',
        actor: 'brand',
        actorUserId: userId,
        fromState: 'invited',
        toState: 'invited',
        payload: { created: true, feeMinor: request.body.feeMinor }
      });

      return row;
    });
  }

  app.post('/collaborations/:id/move', { schema: { body: Move } }, async (request) => {
    const { id } = request.params as { id: string };
    const userId = session(request).userId;
    const current = await ownedCollaboration(actor, userId, id);

    const snapshot: Collaboration = {
      state: current.state,
      counterRounds: current.counterRounds,
      trackedLink: current.trackedLink,
      postUrl: request.body.postUrl ?? current.postUrl,
      lastCounterBy: current.lastCounterBy
    };

    const outcome = transition(snapshot, {
      event: request.body.event,
      actor,
      postUrl: request.body.postUrl ?? current.postUrl
    });

    if (!outcome.ok) {
      throw new HttpError(409, 'illegal_transition', outcome.message);
    }

    const trackedLink = outcome.effects.includes('mint_tracked_link')
      ? (current.trackedLink ?? mintLink(current.reference))
      : current.trackedLink;

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(collaborations)
        .set({
          state: outcome.to,
          counterRounds: outcome.counterRounds,
          lastCounterBy: outcome.lastCounterBy,
          counterFeeMinor:
            request.body.event === 'counter' ? (request.body.feeMinor ?? null) : current.counterFeeMinor,
          feeMinor:
            request.body.event === 'accept' && current.counterFeeMinor !== null
              ? current.counterFeeMinor
              : current.feeMinor,
          draft: request.body.draft ?? current.draft,
          postUrl: request.body.postUrl ?? current.postUrl,
          trackedLink,
          respondedAt: current.respondedAt ?? new Date(),
          updatedAt: new Date()
        })
        .where(eq(collaborations.id, id))
        .returning();

      await tx.insert(collaborationEvents).values({
        collaborationId: id,
        event: request.body.event,
        actor,
        actorUserId: userId,
        fromState: current.state,
        toState: outcome.to,
        payload: { effects: outcome.effects, feeMinor: request.body.feeMinor ?? null }
      });

      if (outcome.effects.includes('count_acceptance')) {
        await tx
          .update(creators)
          .set({ acceptedCount: sql`${creators.acceptedCount} + 1` })
          .where(eq(creators.id, current.creatorId));
      }
      if (outcome.effects.includes('count_delivery')) {
        await tx
          .update(creators)
          .set({ deliveredCount: sql`${creators.deliveredCount} + 1` })
          .where(eq(creators.id, current.creatorId));
      }

      return row!;
    });

    return { collaboration: updated, effects: outcome.effects };
  });

  app.get('/collaborations/:id/events', async (request) => {
    const { id } = request.params as { id: string };
    await ownedCollaboration(actor, session(request).userId, id);

    const rows = await db
      .select()
      .from(collaborationEvents)
      .where(eq(collaborationEvents.collaborationId, id))
      .orderBy(desc(collaborationEvents.createdAt));

    return { items: rows };
  });
}

async function brandFor(userId: string) {
  const workspaceId = await existingWorkspace(userId);
  if (!workspaceId) throw new HttpError(404, 'not_found', 'Finish onboarding first.');

  const [brand] = await db.select().from(brands).where(eq(brands.workspaceId, workspaceId)).limit(1);
  if (!brand) throw new HttpError(404, 'not_found', 'Finish onboarding first.');
  return brand;
}

async function creatorFor(userId: string) {
  const [creator] = await db.select().from(creators).where(eq(creators.userId, userId)).limit(1);
  if (!creator) throw new HttpError(404, 'not_found', 'Finish onboarding first.');
  return creator;
}

async function visibleTo(actor: 'brand' | 'creator', userId: string) {
  if (actor === 'creator') {
    const creator = await creatorFor(userId);
    return db
      .select()
      .from(collaborations)
      .where(eq(collaborations.creatorId, creator.id))
      .orderBy(desc(collaborations.updatedAt));
  }

  const brand = await brandFor(userId);
  return db
    .select({ collaboration: collaborations })
    .from(collaborations)
    .innerJoin(campaigns, eq(collaborations.campaignId, campaigns.id))
    .where(eq(campaigns.brandId, brand.id))
    .orderBy(desc(collaborations.updatedAt))
    .then((rows) => rows.map((r) => r.collaboration));
}

async function ownedCollaboration(actor: 'brand' | 'creator', userId: string, id: string) {
  const rows = await visibleTo(actor, userId);
  const found = rows.find((row) => row.id === id);
  if (!found) throw new HttpError(404, 'not_found', 'No such assignment.');
  return found;
}

function reference() {
  return `A-${Math.floor(1000 + Math.random() * 9000)}${Date.now().toString().slice(-3)}`;
}

function mintLink(ref: string) {
  return `lpwk.co/${ref.replace('A-', '').toLowerCase()}`;
}
