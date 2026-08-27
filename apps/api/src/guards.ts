import type { AccountType } from '@lm/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { auth } from './auth';
import { fail } from './http';
import { toHeaders } from './routes/auth-routes';

declare module 'fastify' {
  interface FastifyRequest {
    session?: { userId: string; email: string; accountType: AccountType };
  }
}

export function requireRole(accountType: AccountType) {
  return async function guard(request: FastifyRequest, reply: FastifyReply) {
    const result = await auth.api.getSession({ headers: toHeaders(request.headers) });

    if (!result?.user) {
      return fail(reply, 401, 'not_authenticated', 'Sign in to continue.');
    }

    const userType = (result.user as { accountType?: AccountType }).accountType;
    if (userType !== accountType) {
      return fail(
        reply,
        403,
        'wrong_account_type',
        `This area is for ${accountType} accounts. You are signed in as a ${userType}.`
      );
    }

    request.session = { userId: result.user.id, email: result.user.email, accountType: userType };
  };
}
