import {
  draftCampaign,
  EmptyDocumentError,
  extractDocument,
  MAX_DOCUMENT_BYTES,
  ThinPageError,
  UnsupportedDocumentError
} from '@lm/ai';
import { DraftCampaignRequest, DraftCampaignResponse } from '@lm/contracts';
import { campaigns } from '@lm/db';
import { desc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../auth';
import { session } from '../guards';
import { fail, HttpError } from '../http';
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
  sourceRef: z.string().max(500).optional(),
  landingUrl: z.string().url().optional()
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

  app.post(
    '/campaigns/draft',
    { schema: { body: DraftCampaignRequest, response: { 200: DraftCampaignResponse } } },
    async (request, reply) => {
      const brand = await brandFor(session(request).userId);

      try {
        const result = await draftCampaign({
          url: request.body.url,
          pastedBrief: request.body.pastedBrief,
          companyName: brand.companyName
        });
        return {
          draft: result.draft,
          source: result.source,
          sourceRef: result.sourceRef,
          charsRead: result.charsRead,
          model: result.model
        };
      } catch (error) {
        if (error instanceof ThinPageError) {
          return fail(reply, 422, 'thin_page', error.message);
        }
        throw error;
      }
    }
  );

  app.post(
    '/campaigns/draft/document',
    { bodyLimit: MAX_DOCUMENT_BYTES, schema: { response: { 200: DraftCampaignResponse } } },
    async (request, reply) => {
      const brand = await brandFor(session(request).userId);

      const form = request.body;
      const upload = form instanceof FormData ? form.get('file') : null;
      if (!(upload instanceof File)) {
        throw new HttpError(400, 'validation_failed', 'Attach one file under the name file.');
      }

      const bytes = new Uint8Array(await upload.arrayBuffer());

      try {
        const document = await extractDocument(upload.name, bytes);
        const result = await draftCampaign({
          pastedBrief: document.text,
          companyName: brand.companyName
        });
        return {
          draft: result.draft,
          source: 'document' as const,
          sourceRef: upload.name,
          charsRead: document.text.length,
          model: result.model
        };
      } catch (error) {
        if (error instanceof UnsupportedDocumentError) {
          return fail(reply, 415, 'unsupported_document', error.message);
        }
        if (error instanceof EmptyDocumentError) {
          return fail(reply, 422, 'empty_document', error.message);
        }
        throw error;
      }
    }
  );

  app.post('/campaigns', { schema: { body: CreateCampaign } }, async (request) => {
    const brand = await brandFor(session(request).userId);
    const body = request.body;

    if (body.budgetMinMinor > body.budgetMaxMinor) {
      throw new HttpError(400, 'validation_failed', 'Minimum budget cannot exceed the maximum.');
    }

    const [row] = await db
      .insert(campaigns)
      .values({
        ...body,
        sourceRef: body.sourceRef ?? null,
        landingUrl: body.landingUrl ?? brand.productUrl,
        brandId: brand.id
      })
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
