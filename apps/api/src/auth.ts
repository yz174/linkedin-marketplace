import { ACCOUNT_TYPES, type AccountType } from '@lm/contracts';
import { accounts, createDb, createPool, sessions, users, verifications } from '@lm/db';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { eq } from 'drizzle-orm';

export const pool = createPool();
export const db = createDb(pool);

export class AccountTypeConflict extends Error {
  constructor(readonly existing: AccountType) {
    super(
      `This email is already registered as a ${existing} account. Sign in at /${existing}/login.`
    );
    this.name = 'AccountTypeConflict';
  }
}

export async function accountTypeFor(email: string): Promise<AccountType | null> {
  const [row] = await db
    .select({ accountType: users.accountType })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return row?.accountType ?? null;
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { user: users, session: sessions, account: accounts, verification: verifications }
  }),
  secret: process.env.AUTH_SECRET,
  baseURL: process.env.API_URL ?? 'http://localhost:3001',
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    autoSignIn: true
  },
  user: {
    additionalFields: {
      accountType: {
        type: ACCOUNT_TYPES as unknown as string[],
        required: true,
        input: true
      }
    }
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24
  },
  advanced: {
    database: { generateId: () => crypto.randomUUID() }
  }
});

export type Auth = typeof auth;
