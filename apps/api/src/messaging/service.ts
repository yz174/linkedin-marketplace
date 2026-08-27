import { MAX_REPLAY, type Actor, type Message } from '@lm/contracts';
import {
  brands,
  campaigns,
  collaborations,
  creators,
  messages,
  workspaceMembers
} from '@lm/db';
import { and, asc, eq, gt, sql } from 'drizzle-orm';
import { db } from '../auth';

export type Participant = {
  collaborationId: string;
  actor: Actor;
  userId: string;
  displayName: string;
};

export async function resolveParticipant(
  collaborationId: string,
  userId: string,
  accountType: 'brand' | 'creator'
): Promise<Participant | null> {
  if (accountType === 'creator') {
    const [row] = await db
      .select({ name: creators.name })
      .from(collaborations)
      .innerJoin(creators, eq(collaborations.creatorId, creators.id))
      .where(and(eq(collaborations.id, collaborationId), eq(creators.userId, userId)))
      .limit(1);

    return row ? { collaborationId, actor: 'creator', userId, displayName: row.name } : null;
  }

  const [row] = await db
    .select({ name: brands.companyName })
    .from(collaborations)
    .innerJoin(campaigns, eq(collaborations.campaignId, campaigns.id))
    .innerJoin(brands, eq(campaigns.brandId, brands.id))
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, brands.workspaceId))
    .where(and(eq(collaborations.id, collaborationId), eq(workspaceMembers.userId, userId)))
    .limit(1);

  return row ? { collaborationId, actor: 'brand', userId, displayName: row.name } : null;
}

export async function appendMessage(input: {
  id: string;
  participant: Participant;
  body: string;
}): Promise<{ message: Message; created: boolean }> {
  return db.transaction(async (tx) => {
    await tx
      .select({ id: collaborations.id })
      .from(collaborations)
      .where(eq(collaborations.id, input.participant.collaborationId))
      .for('update');

    const [existing] = await tx.select().from(messages).where(eq(messages.id, input.id)).limit(1);

    if (existing) {
      if (existing.collaborationId !== input.participant.collaborationId) {
        throw new Error('message id already used in another conversation');
      }
      return { message: toMessage(existing, input.participant.displayName), created: false };
    }

    const [bumped] = await tx
      .update(collaborations)
      .set({ messageSeq: sql`${collaborations.messageSeq} + 1` })
      .where(eq(collaborations.id, input.participant.collaborationId))
      .returning({ seq: collaborations.messageSeq });

    const [row] = await tx
      .insert(messages)
      .values({
        id: input.id,
        collaborationId: input.participant.collaborationId,
        seq: bumped!.seq,
        sender: input.participant.actor,
        senderUserId: input.participant.userId,
        body: input.body
      })
      .returning();

    return { message: toMessage(row!, input.participant.displayName), created: true };
  });
}

export async function historySince(collaborationId: string, afterSeq: number, limit = MAX_REPLAY) {
  const rows = await db
    .select({
      message: messages,
      creatorName: creators.name,
      brandName: brands.companyName
    })
    .from(messages)
    .innerJoin(collaborations, eq(messages.collaborationId, collaborations.id))
    .innerJoin(creators, eq(collaborations.creatorId, creators.id))
    .innerJoin(campaigns, eq(collaborations.campaignId, campaigns.id))
    .innerJoin(brands, eq(campaigns.brandId, brands.id))
    .where(and(eq(messages.collaborationId, collaborationId), gt(messages.seq, afterSeq)))
    .orderBy(asc(messages.seq))
    .limit(limit + 1);

  const truncated = rows.length > limit;
  const page = truncated ? rows.slice(0, limit) : rows;

  return {
    items: page.map((r) =>
      toMessage(r.message, r.message.sender === 'creator' ? r.creatorName : r.brandName)
    ),
    truncated
  };
}

export async function currentSeq(collaborationId: string) {
  const [row] = await db
    .select({ seq: collaborations.messageSeq })
    .from(collaborations)
    .where(eq(collaborations.id, collaborationId))
    .limit(1);
  return row?.seq ?? 0;
}

type MessageRow = typeof messages.$inferSelect;

function toMessage(row: MessageRow, senderName: string): Message {
  return {
    id: row.id,
    collaborationId: row.collaborationId,
    seq: row.seq,
    sender: row.sender,
    senderUserId: row.senderUserId,
    senderName,
    body: row.body,
    createdAt: row.createdAt.toISOString()
  };
}
