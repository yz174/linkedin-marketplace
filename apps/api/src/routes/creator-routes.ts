import { embedDocument, linkedInProvider } from '@lm/ai';
import { CreatorCard, FetchProfileRequest, FetchProfileResponse, SaveCreatorProfile } from '@lm/contracts';
import { creators, linkedinSnapshots } from '@lm/db';
import { desc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { db } from '../auth';
import { fail } from '../http';
import { toCard } from './catalog-shape';

const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;

export function creatorRoutes(instance: FastifyInstance) {
  const app = instance.withTypeProvider<ZodTypeProvider>();

  app.post(
    '/linkedin/fetch',
    { schema: { body: FetchProfileRequest, response: { 200: FetchProfileResponse } } },
    async (request) => {
      const { profileUrl, pastedProfile } = request.body;

      const cached = await freshSnapshot(profileUrl);
      if (cached) return cached;

      const provider = linkedInProvider();
      const result = await provider.fetchProfile(profileUrl, pastedProfile);

      const payload = {
        profile: result.profile,
        fingerprint: result.fingerprint,
        provider: result.provider,
        fetchedAt: new Date().toISOString()
      };

      await db.insert(linkedinSnapshots).values({
        profileUrl,
        provider: result.provider,
        payload
      });

      return payload;
    }
  );

  app.post(
    '/profile',
    { schema: { body: SaveCreatorProfile, response: { 200: CreatorCard } } },
    async (request, reply) => {
      const body = request.body;
      const userId = request.session!.userId;

      const snapshot = await freshSnapshot(body.profileUrl, Number.POSITIVE_INFINITY);
      if (!snapshot) {
        return fail(reply, 422, 'not_found', 'Fetch the LinkedIn profile before saving.');
      }

      const corpus = snapshot.fingerprint.corpus.trim();
      const embedding = corpus ? await embedDocument(corpus) : null;

      const values = {
        userId,
        profileUrl: body.profileUrl,
        name: body.name,
        headline: body.headline,
        bio: body.bio,
        photoUrl: snapshot.profile.photoUrl,
        topics: body.topics,
        ratePerPostMinor: body.ratePerPostMinor,
        followers: snapshot.profile.followers,
        engagementRate: snapshot.fingerprint.engagementRate,
        postsPerWeek: snapshot.fingerprint.postsPerWeek,
        fingerprintEmbedding: embedding,
        updatedAt: new Date()
      };

      const [row] = await db
        .insert(creators)
        .values(values)
        .onConflictDoUpdate({ target: creators.userId, set: values })
        .returning();

      return toCard(row!);
    }
  );

  app.get('/profile', async (request, reply) => {
    const [row] = await db
      .select()
      .from(creators)
      .where(eq(creators.userId, request.session!.userId))
      .limit(1);
    if (!row) return fail(reply, 404, 'not_found', 'No creator profile yet.');
    return toCard(row);
  });
}

async function freshSnapshot(profileUrl: string, ttlMs = SNAPSHOT_TTL_MS) {
  const [row] = await db
    .select()
    .from(linkedinSnapshots)
    .where(eq(linkedinSnapshots.profileUrl, profileUrl))
    .orderBy(desc(linkedinSnapshots.fetchedAt))
    .limit(1);

  if (!row) return null;
  if (Date.now() - row.fetchedAt.getTime() > ttlMs) return null;

  return FetchProfileResponse.parse(row.payload);
}
