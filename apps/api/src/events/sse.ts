import {
  STATUS_HEARTBEAT_MS,
  STATUS_PROTOCOL_VERSION,
  STATUS_RETRY_MS,
  type StatusFrame
} from '@lm/contracts';
import type { FastifyInstance } from 'fastify';
import type { ServerResponse } from 'node:http';
import { env } from '../env';
import { session } from '../guards';
import { brandFor, creatorFor } from '../routes/collab-routes';
import { brandRoom, creatorRoom, type StatusBus } from './bus';

export function statusStream(
  app: FastifyInstance,
  actor: 'brand' | 'creator',
  bus: StatusBus
) {
  const streams = new Set<ServerResponse>();

  app.addHook('onClose', async () => {
    for (const stream of streams) stream.end();
    streams.clear();
  });

  app.get('/events', async (request, reply) => {
    const userId = session(request).userId;
    const room =
      actor === 'brand'
        ? brandRoom((await brandFor(userId)).id)
        : creatorRoom((await creatorFor(userId)).id);

    const stream = reply.raw;
    reply.hijack();

    stream.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
      'access-control-allow-origin': env().WEB_ORIGIN,
      'access-control-allow-credentials': 'true'
    });
    stream.write(`retry: ${STATUS_RETRY_MS}\n\n`);

    const send = (frame: StatusFrame) => {
      if (stream.writableEnded) return;
      stream.write(`event: ${frame.t}\ndata: ${JSON.stringify(frame)}\n\n`);
    };

    streams.add(stream);
    send({ t: 'hello', version: STATUS_PROTOCOL_VERSION, side: actor });

    const unsubscribe = bus.subscribe(room, send);

    const heartbeat = setInterval(() => {
      if (!stream.writableEnded) stream.write(': ping\n\n');
    }, STATUS_HEARTBEAT_MS);
    heartbeat.unref?.();

    const cleanup = () => {
      clearInterval(heartbeat);
      unsubscribe();
      streams.delete(stream);
      stream.end();
    };

    request.raw.on('close', cleanup);
    stream.on('error', cleanup);
  });
}
