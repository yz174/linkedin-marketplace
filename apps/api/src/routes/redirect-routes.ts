import { createHash } from 'node:crypto';
import { brands, campaigns, collaborations, linkClicks } from '@lm/db';
import { eq, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { db } from '../auth';

export function redirectRoutes(app: FastifyInstance) {
  app.get('/r/:code', async (request, reply) => {
    const { code } = request.params as { code: string };

    const [target] = await db
      .select({
        collaborationId: collaborations.id,
        landingUrl: campaigns.landingUrl,
        productUrl: brands.productUrl
      })
      .from(collaborations)
      .innerJoin(campaigns, eq(collaborations.campaignId, campaigns.id))
      .innerJoin(brands, eq(campaigns.brandId, brands.id))
      .where(eq(collaborations.reference, `A-${code.toUpperCase()}`))
      .limit(1);

    if (!target) return reply.code(404).send({ code: 'not_found', message: 'No such link.' });

    await recordClick(target.collaborationId, request);

    return reply.redirect(target.landingUrl || target.productUrl, 302);
  });
}

async function recordClick(collaborationId: string, request: FastifyRequest) {
  const visitorHash = createHash('sha256')
    .update(`${request.ip}|${request.headers['user-agent'] ?? ''}`)
    .digest('hex');

  await db
    .insert(linkClicks)
    .values({
      collaborationId,
      visitorHash,
      clickedOn: new Date().toISOString().slice(0, 10)
    })
    .onConflictDoUpdate({
      target: [linkClicks.collaborationId, linkClicks.visitorHash, linkClicks.clickedOn],
      set: { hits: sql`${linkClicks.hits} + 1`, lastAt: new Date() }
    });
}
