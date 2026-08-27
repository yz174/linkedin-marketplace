import Fastify, { type FastifyError } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider
} from 'fastify-type-provider-zod';
import { auth } from './auth';
import { env } from './env';
import { requireRole } from './guards';
import { authRoutes, forward, toHeaders } from './routes/auth-routes';

export function buildApp() {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error.validation) {
      return reply.status(400).send({ code: 'validation_failed', message: error.message });
    }
    reply.status(error.statusCode ?? 500).send({
      code: 'validation_failed',
      message: error.message
    });
  });

  app.addHook('onSend', async (request, reply) => {
    reply.header('access-control-allow-origin', env().WEB_ORIGIN);
    reply.header('access-control-allow-credentials', 'true');
    reply.header('access-control-allow-headers', 'content-type');
    if (request.method === 'OPTIONS') reply.header('access-control-allow-methods', 'GET,POST,PATCH,OPTIONS');
  });

  app.options('/*', async (_request, reply) => reply.status(204).send());

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
      });
    },
    { prefix: '/creator' }
  );

  return app;
}
