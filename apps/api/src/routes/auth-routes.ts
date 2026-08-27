import { AccountType, Email, SignIn, SignUp } from '@lm/contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { accountTypeFor, auth } from '../auth';
import { fail } from '../http';

export function authRoutes(instance: FastifyInstance, accountType: AccountType) {
  const app = instance.withTypeProvider<ZodTypeProvider>();

  app.post('/signup', { schema: { body: SignUp.omit({ accountType: true }) } }, async (request, reply) => {
    const { email, password, name } = request.body;

    const existing = await accountTypeFor(email);
    if (existing && existing !== accountType) {
      return fail(reply, 409, 'email_belongs_to_other_account_type', otherTypeMessage(existing));
    }
    if (existing) {
      return fail(reply, 409, 'email_taken', 'That email already has an account. Sign in instead.');
    }

    const response = await auth.api.signUpEmail({
      body: { email, password, name, accountType },
      asResponse: true
    });
    return forward(reply, response);
  });

  app.post('/login', { schema: { body: SignIn.omit({ accountType: true }) } }, async (request, reply) => {
    const { email, password } = request.body;

    const existing = await accountTypeFor(email);
    if (existing && existing !== accountType) {
      return fail(reply, 409, 'email_belongs_to_other_account_type', otherTypeMessage(existing));
    }

    const response = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
    if (response.status >= 400) {
      return fail(reply, 401, 'invalid_credentials', 'That email and password do not match.');
    }
    return forward(reply, response);
  });

  app.post('/logout', async (request, reply) => {
    const response = await auth.api.signOut({
      headers: toHeaders(request.headers),
      asResponse: true
    });
    return forward(reply, response);
  });

  function otherTypeMessage(existing: AccountType) {
    const other = existing === 'brand' ? 'brand' : 'creator';
    return `This email is already registered as a ${other} account. Sign in at /${other}/login.`;
  }
}

export function toHeaders(source: Record<string, unknown>) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'string') headers.set(key, value);
    else if (Array.isArray(value)) for (const v of value) headers.append(key, String(v));
  }
  return headers;
}

export async function forward(reply: import('fastify').FastifyReply, response: Response) {
  reply.status(response.status);

  const cookies = response.headers.getSetCookie();
  if (cookies.length > 0) reply.header('set-cookie', cookies);

  for (const [key, value] of response.headers.entries()) {
    if (key.toLowerCase() === 'set-cookie') continue;
    reply.header(key, value);
  }

  const text = await response.text();
  return text ? reply.send(JSON.parse(text)) : reply.send();
}

export const EmailProbe = Email;
