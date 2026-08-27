import { createHash } from 'node:crypto';
import { idempotencyKeys } from '@lm/db';
import { eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import { db } from '../auth';
import { HttpError } from '../http';

function hashOf(body: unknown) {
  return createHash('sha256').update(JSON.stringify(body ?? null)).digest('hex');
}

export async function withIdempotency<T>(
  request: FastifyRequest,
  userId: string,
  run: () => Promise<T>
): Promise<T> {
  const key = request.headers['idempotency-key'];
  if (typeof key !== 'string' || key.trim().length === 0) {
    throw new HttpError(
      400,
      'validation_failed',
      'This endpoint moves money and needs an Idempotency-Key header.'
    );
  }

  const requestHash = hashOf(request.body);

  const [seen] = await db
    .select()
    .from(idempotencyKeys)
    .where(eq(idempotencyKeys.key, key))
    .limit(1);

  if (seen) {
    if (seen.requestHash !== requestHash) {
      throw new HttpError(
        409,
        'validation_failed',
        'That Idempotency-Key was used for a different request.'
      );
    }
    return seen.responseBody as T;
  }

  const result = await run();

  await db
    .insert(idempotencyKeys)
    .values({
      key,
      userId,
      requestHash,
      statusCode: 200,
      responseBody: result as never
    })
    .onConflictDoNothing();

  return result;
}
