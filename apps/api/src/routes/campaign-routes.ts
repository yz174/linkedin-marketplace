import { campaigns } from '@lm/db';
import { desc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../auth';
import { session } from '../guards';
import { HttpError } from '../http';
import { brands } from '@lm/db';
import { existingWorkspace } from './brand-routes';

const CreateCampaign = z.object({
  title: z.string().trim().min(1).max(160),
  objective: z.string().trim().min(10).max(1000),
  keyMessages: z.array(z.string().trim().min(1).max(300)).max(8).default([]),
  doNot: z.array(z.string().trim().min(1).max(300)).max(8).default([]),
  deliverable: z.string().trim().min(1).max(300),
  budgetMinMinor: z.number().int().min(0),
  budgetMaxMinor: z.number().int().min(0),
  source: z.enum(['ai', 'url', 'document']),
  sourceRef: z.string().max(500).optional()
});

export function campaignRoutes(instance: FastifyInstance) {
  const app = instance.withTypeProvider<ZodTypeProvider>();

  app.get('/campaigns', async (request) => {
    const brand = await brandFor(session(request).userId);
    const items = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.brandId, brand.id))
      .orderBy(desc(campaigns.createdAt));
    return { items };
  });

  app.post('/campaigns', { schema: { body: CreateCampaign } }, async (request) => {
    const brand = await brandFor(session(request).userId);
    const body = request.body;

    if (body.budgetMinMinor > body.budgetMaxMinor) {
      throw new HttpError(400, 'validation_failed', 'Minimum budget cannot exceed the maximum.');
    }

    const [row] = await db
      .insert(campaigns)
      .values({ ...body, sourceRef: body.sourceRef ?? null, brandId: brand.id })
      .returning();
    return row;
  });
}

async function brandFor(userId: string) {
  const workspaceId = await existingWorkspace(userId);
  if (!workspaceId) throw new HttpError(404, 'not_found', 'Finish onboarding first.');
  const [brand] = await db.select().from(brands).where(eq(brands.workspaceId, workspaceId)).limit(1);
  if (!brand) throw new HttpError(404, 'not_found', 'Finish onboarding first.');
  return brand;
}
