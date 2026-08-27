import { BrandWallet, CreatorWallet, Money } from '@lm/contracts';
import { collaborations, escrowHolds, ledgerEntries } from '@lm/db';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { db } from '../auth';
import { withIdempotency } from '../billing/idempotency';
import { creatorWallet, topUp, withdraw, workspaceWallet } from '../billing/ledger';
import { session } from '../guards';
import { brandFor, creatorFor } from './collab-routes';

const LEDGER_PAGE = 50;

export function brandWalletRoutes(instance: FastifyInstance) {
  const app = instance.withTypeProvider<ZodTypeProvider>();

  app.get('/wallet', { schema: { response: { 200: BrandWallet } } }, async (request) => {
    const brand = await brandFor(session(request).userId);
    const wallet = await db.transaction((tx) => workspaceWallet(tx, brand.workspaceId));

    const [held] = await db
      .select({ total: sql<number>`coalesce(sum(${escrowHolds.amountMinor}), 0)::int` })
      .from(escrowHolds)
      .where(and(eq(escrowHolds.workspaceId, brand.workspaceId), eq(escrowHolds.state, 'held')));

    return {
      balanceMinor: wallet.balanceMinor,
      heldMinor: held!.total,
      entries: await entriesFor(wallet.id)
    };
  });

  app.post(
    '/wallet/topup',
    { schema: { body: Money, response: { 200: BrandWallet } } },
    async (request) => {
      const userId = session(request).userId;
      const brand = await brandFor(userId);

      return withIdempotency(request, userId, async () => {
        const wallet = await db.transaction(async (tx) => {
          await topUp(tx, { workspaceId: brand.workspaceId, amountMinor: request.body.amountMinor });
          return workspaceWallet(tx, brand.workspaceId);
        });

        const [held] = await db
          .select({ total: sql<number>`coalesce(sum(${escrowHolds.amountMinor}), 0)::int` })
          .from(escrowHolds)
          .where(
            and(eq(escrowHolds.workspaceId, brand.workspaceId), eq(escrowHolds.state, 'held'))
          );

        return {
          balanceMinor: wallet.balanceMinor,
          heldMinor: held!.total,
          entries: await entriesFor(wallet.id)
        };
      });
    }
  );
}

export function creatorWalletRoutes(instance: FastifyInstance) {
  const app = instance.withTypeProvider<ZodTypeProvider>();

  app.get('/wallet', { schema: { response: { 200: CreatorWallet } } }, async (request) => {
    const creator = await creatorFor(session(request).userId);
    const wallet = await db.transaction((tx) => creatorWallet(tx, creator.id));

    return {
      balanceMinor: wallet.balanceMinor,
      pendingMinor: await pendingFor(creator.id),
      entries: await entriesFor(wallet.id)
    };
  });

  app.post(
    '/wallet/withdraw',
    { schema: { body: Money, response: { 200: CreatorWallet } } },
    async (request) => {
      const userId = session(request).userId;
      const creator = await creatorFor(userId);

      return withIdempotency(request, userId, async () => {
        const wallet = await db.transaction(async (tx) => {
          await withdraw(tx, { creatorId: creator.id, amountMinor: request.body.amountMinor });
          return creatorWallet(tx, creator.id);
        });

        return {
          balanceMinor: wallet.balanceMinor,
          pendingMinor: await pendingFor(creator.id),
          entries: await entriesFor(wallet.id)
        };
      });
    }
  );
}

async function entriesFor(walletId: string) {
  const rows = await db
    .select({
      id: ledgerEntries.id,
      kind: ledgerEntries.kind,
      amountMinor: ledgerEntries.amountMinor,
      reference: collaborations.reference,
      createdAt: ledgerEntries.createdAt
    })
    .from(ledgerEntries)
    .leftJoin(collaborations, eq(ledgerEntries.collaborationId, collaborations.id))
    .where(eq(ledgerEntries.walletId, walletId))
    .orderBy(desc(ledgerEntries.createdAt))
    .limit(LEDGER_PAGE);

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    amountMinor: row.amountMinor,
    reference: row.reference,
    createdAt: row.createdAt.toISOString()
  }));
}

async function pendingFor(creatorId: string) {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${escrowHolds.amountMinor}), 0)::int` })
    .from(escrowHolds)
    .innerJoin(collaborations, eq(escrowHolds.collaborationId, collaborations.id))
    .where(and(eq(collaborations.creatorId, creatorId), eq(escrowHolds.state, 'held')));

  return row!.total;
}
