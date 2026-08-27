import { MessagePage } from '@lm/contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { session } from '../guards';
import { HttpError } from '../http';
import { currentSeq, historySince, resolveParticipant } from '../messaging/service';
import { issueTicket } from '../messaging/ticket';

const Query = z.object({
  after: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(500).default(200)
});

export function messageRoutes(instance: FastifyInstance, accountType: 'brand' | 'creator') {
  const app = instance.withTypeProvider<ZodTypeProvider>();

  app.get(
    '/collaborations/:id/messages',
    { schema: { querystring: Query, response: { 200: MessagePage } } },
    async (request) => {
      const { id } = request.params as { id: string };
      const participant = await resolveParticipant(id, session(request).userId, accountType);
      if (!participant) throw new HttpError(404, 'not_found', 'No such conversation.');

      const [history, lastSeq] = await Promise.all([
        historySince(id, request.query.after, request.query.limit),
        currentSeq(id)
      ]);

      return { items: history.items, lastSeq, truncated: history.truncated };
    }
  );

  app.post('/collaborations/:id/ws-ticket', async (request) => {
    const { id } = request.params as { id: string };
    const userId = session(request).userId;

    const participant = await resolveParticipant(id, userId, accountType);
    if (!participant) throw new HttpError(404, 'not_found', 'No such conversation.');

    return issueTicket({ userId, accountType, collaborationId: id });
  });
}
