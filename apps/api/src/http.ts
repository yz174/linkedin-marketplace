import type { ErrorCode } from '@lm/contracts';
import type { FastifyReply } from 'fastify';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function fail(reply: FastifyReply, status: number, code: ErrorCode, message: string) {
  return reply.status(status).send({ code, message });
}
