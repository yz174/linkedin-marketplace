import type { ErrorCode } from '@lm/contracts';
import type { FastifyReply } from 'fastify';

export function fail(reply: FastifyReply, status: number, code: ErrorCode, message: string) {
  return reply.status(status).send({ code, message });
}
