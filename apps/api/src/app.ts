import websocket from '@fastify/websocket';
import Fastify, { type FastifyError } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider
} from 'fastify-type-provider-zod';
import { auth } from './auth';
import { env } from './env';
import { requireRole } from './guards';
import { HttpError } from './http';
import { authRoutes, forward, toHeaders } from './routes/auth-routes';
import { brandRoutes } from './routes/brand-routes';
import { catalogRoutes } from './routes/catalog-routes';
import { InProcessBroker, type Broker } from './messaging/broker';
import { registerMessageSocket } from './messaging/ws';
import { campaignRoutes } from './routes/campaign-routes';
import { collabRoutes } from './routes/collab-routes';
import { messageRoutes } from './routes/message-routes';
import { creatorRoutes } from './routes/creator-routes';

export function buildApp(broker: Broker = new InProcessBroker()) {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();

  app.register(websocket, {
    options: { maxPayload: 64 * 1024 }
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error instanceof HttpError) {
      return reply.status(error.status).send({ code: error.code, message: error.message });
    }
    if (error.validation) {
      return reply.status(400).send({ code: 'validation_failed', message: error.message });
    }
    return reply.status(error.statusCode ?? 500).send({
      code: 'validation_failed',
      message: error.message
    });
  });

  app.addHook('onRequest', async (request, reply) => {
    reply.header('access-control-allow-origin', env().WEB_ORIGIN);
    reply.header('access-control-allow-credentials', 'true');
    reply.header('access-control-allow-headers', 'content-type');
    reply.header('access-control-allow-methods', 'GET,POST,PATCH,OPTIONS');
    if (request.method === 'OPTIONS') return reply.status(204).send();
  });

  app.get('/health', async () => ({ ok: true }));

  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    handler: async (request, reply) => {
      const url = new URL(request.url, env().API_URL);
      const response = await auth.handler(
        new Request(url, {
          method: request.method,
          headers: toHeaders(request.headers),
          body: request.method === 'GET' ? undefined : JSON.stringify(request.body ?? {})
        })
      );
      return forward(reply, response);
    }
  });

  app.register(
    async (brand) => {
      authRoutes(brand, 'brand');
      brand.register(async (guarded) => {
        guarded.addHook('preHandler', requireRole('brand'));
        guarded.get('/me', async (request) => request.session);
        brandRoutes(guarded);
        catalogRoutes(guarded);
        campaignRoutes(guarded);
        collabRoutes(guarded, 'brand');
        messageRoutes(guarded, 'brand');
      });
    },
    { prefix: '/brand' }
  );

  app.register(
    async (creator) => {
      authRoutes(creator, 'creator');
      creator.register(async (guarded) => {
        guarded.addHook('preHandler', requireRole('creator'));
        guarded.get('/me', async (request) => request.session);
        creatorRoutes(guarded);
        collabRoutes(guarded, 'creator');
        messageRoutes(guarded, 'creator');
      });
    },
    { prefix: '/creator' }
  );

  app.register(async (sockets) => {
    registerMessageSocket(sockets, broker);
  });

  app.addHook('onClose', async () => {
    await broker.close();
  });

  return app;
}
