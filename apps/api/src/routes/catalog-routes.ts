import { CatalogQuery, CatalogResponse, DEFAULT_WEIGHTS } from '@lm/contracts';
import { brands, creators } from '@lm/db';
import { rankCreators } from '@lm/match';
import { eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { db } from '../auth';
import { fail } from '../http';
import { existingWorkspace } from './brand-routes';
import { toCard } from './catalog-shape';

export function catalogRoutes(instance: FastifyInstance) {
  const app = instance.withTypeProvider<ZodTypeProvider>();

  app.get(
    '/catalog',
    { schema: { querystring: CatalogQuery, response: { 200: CatalogResponse } } },
    async (request, reply) => {
      const workspaceId = await existingWorkspace(request.session!.userId);
      if (!workspaceId) return fail(reply, 404, 'not_found', 'Finish onboarding first.');

      const [brand] = await db.select().from(brands).where(eq(brands.workspaceId, workspaceId)).limit(1);
      if (!brand) return fail(reply, 404, 'not_found', 'Finish onboarding first.');

      const weights = request.query.weights ?? DEFAULT_WEIGHTS;
      const icpVector = brand.icpEmbedding ? toVectorLiteral(brand.icpEmbedding) : null;

      const similarity = icpVector
        ? sql<number>`1 - (${creators.fingerprintEmbedding} <=> ${icpVector}::vector)`
        : sql<number>`null::float8`;

      const rows = await db
        .select({ creator: creators, similarity })
        .from(creators)
        .where(eq(creators.listed, true));

      const scored = rankCreators(
        { sectors: brand.sectors, budgetPerPostMinor: undefined },
        rows.map((r) => ({
          id: r.creator.id,
          row: r.creator,
          creator: {
            topics: r.creator.topics,
            followers: r.creator.followers,
            engagementRate: r.creator.engagementRate,
            postsPerWeek: r.creator.postsPerWeek,
            ratePerPostMinor: r.creator.ratePerPostMinor,
            acceptedCount: r.creator.acceptedCount,
            deliveredCount: r.creator.deliveredCount,
            openSlots: r.creator.openSlots,
            semanticFit: r.similarity === null ? undefined : clamp01((r.similarity + 1) / 2)
          }
        })),
        weights
      );

      const view = request.query.view;
      const relevant = view === 'all' ? scored : scored.filter((s) => s.match.components.tagAffinity > 0);
      const page = relevant.slice(0, request.query.limit);

      return {
        items: page.map((s) => ({ creator: toCard(s.row), match: s.match })),
        nextCursor: null,
        total: relevant.length
      };
    }
  );
}

function toVectorLiteral(values: number[]) {
  return `[${values.join(',')}]`;
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}
