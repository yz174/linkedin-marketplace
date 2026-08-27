import { BrandAnalytics } from '@lm/contracts';
import { campaigns, collaborations, escrowHolds, linkClicks } from '@lm/db';
import { eq, inArray, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { db } from '../auth';
import { session } from '../guards';
import { brandFor } from './collab-routes';

const PUBLISHED_ON: string[] = ['published', 'verified', 'paid'];

export function analyticsRoutes(instance: FastifyInstance) {
  const app = instance.withTypeProvider<ZodTypeProvider>();

  app.get('/analytics', { schema: { response: { 200: BrandAnalytics } } }, async (request) => {
    const brand = await brandFor(session(request).userId);

    const owned = await db
      .select({ id: campaigns.id, title: campaigns.title })
      .from(campaigns)
      .where(eq(campaigns.brandId, brand.id));

    if (owned.length === 0) {
      return { campaigns: [], totals: empty() };
    }

    const rows = await db
      .select({
        id: collaborations.id,
        campaignId: collaborations.campaignId,
        state: collaborations.state
      })
      .from(collaborations)
      .where(
        inArray(
          collaborations.campaignId,
          owned.map((campaign) => campaign.id)
        )
      );

    const ids = rows.map((row) => row.id);

    const clicks = ids.length
      ? await db
          .select({
            collaborationId: linkClicks.collaborationId,
            hits: sql<number>`sum(${linkClicks.hits})::int`,
            visitors: sql<number>`count(*)::int`
          })
          .from(linkClicks)
          .where(inArray(linkClicks.collaborationId, ids))
          .groupBy(linkClicks.collaborationId)
      : [];

    const holds = ids.length
      ? await db
          .select({
            collaborationId: escrowHolds.collaborationId,
            state: escrowHolds.state,
            amountMinor: escrowHolds.amountMinor
          })
          .from(escrowHolds)
          .where(inArray(escrowHolds.collaborationId, ids))
      : [];

    const clicksBy = new Map(clicks.map((row) => [row.collaborationId, row]));
    const holdsBy = new Map(holds.map((row) => [row.collaborationId, row]));

    const perCampaign = owned.map((campaign) => {
      const mine = rows.filter((row) => row.campaignId === campaign.id);

      let spendMinor = 0;
      let committedMinor = 0;
      let clickTotal = 0;
      let visitorTotal = 0;

      for (const row of mine) {
        const hold = holdsBy.get(row.id);
        if (hold?.state === 'released') spendMinor += hold.amountMinor;
        if (hold?.state === 'held') committedMinor += hold.amountMinor;

        const click = clicksBy.get(row.id);
        clickTotal += click?.hits ?? 0;
        visitorTotal += click?.visitors ?? 0;
      }

      return {
        campaignId: campaign.id,
        title: campaign.title,
        assignments: mine.length,
        published: mine.filter((row) => PUBLISHED_ON.includes(row.state)).length,
        spendMinor,
        committedMinor,
        clicks: clickTotal,
        visitors: visitorTotal,
        costPerClickMinor: costPerClick(spendMinor, clickTotal)
      };
    });

    const totals = perCampaign.reduce(
      (sum, campaign) => ({
        spendMinor: sum.spendMinor + campaign.spendMinor,
        committedMinor: sum.committedMinor + campaign.committedMinor,
        clicks: sum.clicks + campaign.clicks,
        visitors: sum.visitors + campaign.visitors,
        costPerClickMinor: null
      }),
      empty()
    );

    return {
      campaigns: perCampaign,
      totals: { ...totals, costPerClickMinor: costPerClick(totals.spendMinor, totals.clicks) }
    };
  });
}

function costPerClick(spendMinor: number, clicks: number) {
  return clicks === 0 ? null : Math.round(spendMinor / clicks);
}

function empty() {
  return {
    spendMinor: 0,
    committedMinor: 0,
    clicks: 0,
    visitors: 0,
    costPerClickMinor: null as number | null
  };
}
