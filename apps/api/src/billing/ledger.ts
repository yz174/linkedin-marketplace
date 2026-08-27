import { escrowHolds, ledgerEntries, wallets } from '@lm/db';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../auth';
import { HttpError } from '../http';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type Wallet = typeof wallets.$inferSelect;
type LedgerKind = (typeof ledgerEntries.$inferSelect)['kind'];

export class InsufficientFunds extends HttpError {
  constructor(shortfallMinor: number) {
    super(
      402,
      'insufficient_funds',
      `That wallet is short by ${(shortfallMinor / 100).toFixed(2)}. Top it up and try again.`
    );
    this.name = 'InsufficientFunds';
  }
}

export async function workspaceWallet(tx: Tx, workspaceId: string): Promise<Wallet> {
  const [existing] = await tx
    .select()
    .from(wallets)
    .where(eq(wallets.workspaceId, workspaceId))
    .limit(1);
  if (existing) return existing;

  const [created] = await tx
    .insert(wallets)
    .values({ owner: 'workspace', workspaceId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  return workspaceWallet(tx, workspaceId);
}

export async function creatorWallet(tx: Tx, creatorId: string): Promise<Wallet> {
  const [existing] = await tx
    .select()
    .from(wallets)
    .where(eq(wallets.creatorId, creatorId))
    .limit(1);
  if (existing) return existing;

  const [created] = await tx
    .insert(wallets)
    .values({ owner: 'creator', creatorId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  return creatorWallet(tx, creatorId);
}

async function singleton(tx: Tx, owner: 'escrow' | 'platform'): Promise<Wallet> {
  const [existing] = await tx.select().from(wallets).where(eq(wallets.owner, owner)).limit(1);
  if (existing) return existing;

  const [created] = await tx.insert(wallets).values({ owner }).onConflictDoNothing().returning();
  if (created) return created;

  return singleton(tx, owner);
}

export const escrowWallet = (tx: Tx) => singleton(tx, 'escrow');
export const platformWallet = (tx: Tx) => singleton(tx, 'platform');

async function move(
  tx: Tx,
  input: {
    from: Wallet;
    to: Wallet;
    amountMinor: number;
    kind: LedgerKind;
    collaborationId?: string;
  }
) {
  if (input.amountMinor <= 0) {
    throw new HttpError(400, 'validation_failed', 'A movement must be a positive amount.');
  }

  const entryGroup = crypto.randomUUID();

  const [locked] = await tx
    .select()
    .from(wallets)
    .where(eq(wallets.id, input.from.id))
    .for('update')
    .limit(1);

  if (locked!.owner !== 'platform' && locked!.balanceMinor < input.amountMinor) {
    throw new InsufficientFunds(input.amountMinor - locked!.balanceMinor);
  }

  await tx
    .update(wallets)
    .set({ balanceMinor: sql`${wallets.balanceMinor} - ${input.amountMinor}` })
    .where(eq(wallets.id, input.from.id));

  await tx
    .update(wallets)
    .set({ balanceMinor: sql`${wallets.balanceMinor} + ${input.amountMinor}` })
    .where(eq(wallets.id, input.to.id));

  await tx.insert(ledgerEntries).values([
    {
      entryGroup,
      walletId: input.from.id,
      kind: input.kind,
      amountMinor: -input.amountMinor,
      collaborationId: input.collaborationId ?? null
    },
    {
      entryGroup,
      walletId: input.to.id,
      kind: input.kind,
      amountMinor: input.amountMinor,
      collaborationId: input.collaborationId ?? null
    }
  ]);

  return entryGroup;
}

export async function topUp(tx: Tx, input: { workspaceId: string; amountMinor: number }) {
  const to = await workspaceWallet(tx, input.workspaceId);
  const from = await platformWallet(tx);
  await move(tx, { from, to, amountMinor: input.amountMinor, kind: 'topup' });
  return balanceOf(tx, to.id);
}

export async function withdraw(tx: Tx, input: { creatorId: string; amountMinor: number }) {
  const from = await creatorWallet(tx, input.creatorId);
  const to = await platformWallet(tx);
  await move(tx, { from, to, amountMinor: input.amountMinor, kind: 'withdraw' });
  return balanceOf(tx, from.id);
}

export async function holdEscrow(
  tx: Tx,
  input: { collaborationId: string; workspaceId: string; amountMinor: number }
) {
  const [existing] = await tx
    .select()
    .from(escrowHolds)
    .where(eq(escrowHolds.collaborationId, input.collaborationId))
    .limit(1);
  if (existing) return existing;

  const from = await workspaceWallet(tx, input.workspaceId);
  const to = await escrowWallet(tx);
  await move(tx, {
    from,
    to,
    amountMinor: input.amountMinor,
    kind: 'hold',
    collaborationId: input.collaborationId
  });

  const [hold] = await tx
    .insert(escrowHolds)
    .values({
      collaborationId: input.collaborationId,
      workspaceId: input.workspaceId,
      amountMinor: input.amountMinor
    })
    .returning();

  return hold!;
}

export async function releaseEscrow(tx: Tx, input: { collaborationId: string; creatorId: string }) {
  const hold = await openHold(tx, input.collaborationId);
  if (!hold) return null;

  const from = await escrowWallet(tx);
  const to = await creatorWallet(tx, input.creatorId);
  await move(tx, {
    from,
    to,
    amountMinor: hold.amountMinor,
    kind: 'release',
    collaborationId: input.collaborationId
  });

  return settle(tx, hold.id, 'released');
}

export async function refundEscrow(tx: Tx, input: { collaborationId: string }) {
  const hold = await openHold(tx, input.collaborationId);
  if (!hold) return null;

  const from = await escrowWallet(tx);
  const to = await workspaceWallet(tx, hold.workspaceId);
  await move(tx, {
    from,
    to,
    amountMinor: hold.amountMinor,
    kind: 'refund',
    collaborationId: input.collaborationId
  });

  return settle(tx, hold.id, 'refunded');
}

async function openHold(tx: Tx, collaborationId: string) {
  const [hold] = await tx
    .select()
    .from(escrowHolds)
    .where(and(eq(escrowHolds.collaborationId, collaborationId), eq(escrowHolds.state, 'held')))
    .limit(1);
  return hold ?? null;
}

async function settle(tx: Tx, holdId: string, state: 'released' | 'refunded') {
  const [row] = await tx
    .update(escrowHolds)
    .set({ state, settledAt: new Date() })
    .where(and(eq(escrowHolds.id, holdId), eq(escrowHolds.state, 'held')))
    .returning();
  return row ?? null;
}

async function balanceOf(tx: Tx, walletId: string) {
  const [row] = await tx
    .select({ balanceMinor: wallets.balanceMinor })
    .from(wallets)
    .where(eq(wallets.id, walletId))
    .limit(1);
  return row!.balanceMinor;
}
