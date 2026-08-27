import websocket from '@fastify/websocket';
import type { Message } from '@lm/contracts';
import Fastify, { type FastifyError, type FastifyRequest } from 'fastify';
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
import { analyticsRoutes } from './routes/analytics-routes';
import { brandRoutes } from './routes/brand-routes';
import { catalogRoutes } from './routes/catalog-routes';
import { InProcessBroker, type Broker } from './messaging/broker';
import type { StatusBus } from './events/bus';
import { statusStream } from './events/sse';
import { registerMessageSocket } from './messaging/ws';
import { campaignRoutes } from './routes/campaign-routes';
import { collabRoutes } from './routes/collab-routes';
import { messageRoutes } from './routes/message-routes';
import { redirectRoutes } from './routes/redirect-routes';
import { brandWalletRoutes, creatorWalletRoutes } from './routes/wallet-routes';
import { creatorRoutes } from './routes/creator-routes';
import { invitePreviewRoute, workspaceRoutes } from './routes/workspace-routes';

export function buildApp(
  broker: Broker<Message> = new InProcessBroker(),
  bus: StatusBus = new InProcessBroker()
) {
  const app = Fastify({
    logger: false,
    forceCloseConnections: true
  }).withTypeProvider<ZodTypeProvider>();

  app.register(websocket, {
    options: { maxPayload: 64 * 1024 }
  });

  app.addContentTypeParser<Buffer>(
    'multipart/form-data',
    { parseAs: 'buffer' },
    async (request: FastifyRequest, body: Buffer) => {
      const upload = new Response(new Uint8Array(body), {
        headers: { 'content-type': String(request.headers['content-type']) }
      });
      return upload.formData();
    }
  );

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

  redirectRoutes(app);

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
      invitePreviewRoute(brand);
      brand.register(async (guarded) => {
        guarded.addHook('preHandler', requireRole('brand'));
        guarded.get('/me', async (request) => request.session);
        brandRoutes(guarded);
        workspaceRoutes(guarded);
        catalogRoutes(guarded);
        campaignRoutes(guarded);
        collabRoutes(guarded, 'brand', bus);
        statusStream(guarded, 'brand', bus);
        messageRoutes(guarded, 'brand');
        brandWalletRoutes(guarded);
        analyticsRoutes(guarded);
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
        collabRoutes(guarded, 'creator', bus);
        statusStream(guarded, 'creator', bus);
        messageRoutes(guarded, 'creator');
        creatorWalletRoutes(guarded);
      });
    },
    { prefix: '/creator' }
  );

  app.register(async (sockets) => {
    registerMessageSocket(sockets, broker);
  });

  app.addHook('onClose', async () => {
    await broker.close();
    await bus.close();
  });

  return app;
}
