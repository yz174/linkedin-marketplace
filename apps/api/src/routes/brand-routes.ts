import { embedQuery, generateIcp, ThinPageError } from '@lm/ai';
import { BrandProfile, GenerateIcpRequest, GenerateIcpResponse, SaveBrandProfile } from '@lm/contracts';
import { brands, workspaceMembers, workspaces } from '@lm/db';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { db } from '../auth';
import { session } from '../guards';
import { fail } from '../http';

export function brandRoutes(instance: FastifyInstance) {
  const app = instance.withTypeProvider<ZodTypeProvider>();

  app.post(
    '/icp/generate',
    { schema: { body: GenerateIcpRequest, response: { 200: GenerateIcpResponse } } },
    async (request, reply) => {
      try {
        const result = await generateIcp({
          productUrl: request.body.productUrl,
          pastedPositioning: request.body.pastedPositioning
        });
        return {
          icp: result.icp,
          source: result.source,
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
    '/profile',
    { schema: { body: SaveBrandProfile, response: { 200: BrandProfile } } },
    async (request) => {
      const { companyName, productUrl, icp } = request.body;
      const userId = session(request).userId;

      const embedding = await embedQuery([icp.summary, ...icp.points].join('\n'));
      const workspaceId = await workspaceFor(userId, companyName);

      const [row] = await db
        .insert(brands)
        .values({
          workspaceId,
          companyName,
          productUrl,
          icpSummary: icp.summary,
          icpPoints: icp.points,
          buyerTitles: icp.buyerTitles,
          sectors: icp.sectors,
          icpEmbedding: embedding,
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: brands.workspaceId,
          set: {
            companyName,
            productUrl,
            icpSummary: icp.summary,
            icpPoints: icp.points,
            buyerTitles: icp.buyerTitles,
            sectors: icp.sectors,
            icpEmbedding: embedding,
            updatedAt: new Date()
          }
        })
        .returning();

      return {
        id: row!.id,
        workspaceId: row!.workspaceId,
        companyName: row!.companyName,
        productUrl: row!.productUrl,
        icp: {
          summary: row!.icpSummary,
          points: row!.icpPoints,
          buyerTitles: row!.buyerTitles,
          sectors: row!.sectors
        },
        updatedAt: row!.updatedAt.toISOString()
      };
    }
  );

  app.get('/profile', async (request, reply) => {
    const workspaceId = await existingWorkspace(session(request).userId);
    if (!workspaceId) return fail(reply, 404, 'not_found', 'No brand profile yet.');

    const [row] = await db.select().from(brands).where(eq(brands.workspaceId, workspaceId)).limit(1);
    if (!row) return fail(reply, 404, 'not_found', 'No brand profile yet.');

    return {
      id: row.id,
      workspaceId: row.workspaceId,
      companyName: row.companyName,
      productUrl: row.productUrl,
      icp: {
        summary: row.icpSummary,
        points: row.icpPoints,
        buyerTitles: row.buyerTitles,
        sectors: row.sectors
      },
      updatedAt: row.updatedAt.toISOString()
    };
  });
}

export async function existingWorkspace(userId: string) {
  const [membership] = await db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, userId))
    .limit(1);
  return membership?.workspaceId ?? null;
}

async function workspaceFor(userId: string, companyName: string) {
  const existing = await existingWorkspace(userId);
  if (existing) return existing;

  return db.transaction(async (tx) => {
    const [workspace] = await tx.insert(workspaces).values({ name: companyName }).returning();
    await tx
      .insert(workspaceMembers)
      .values({ workspaceId: workspace!.id, userId, role: 'owner' });
    return workspace!.id;
  });
}
