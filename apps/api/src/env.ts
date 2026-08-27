import { z } from 'zod';

const Env = z.object({
  PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  HOST: z.string().default('0.0.0.0'),
  API_URL: z.string().url().default('http://localhost:3001'),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  AUTH_SECRET: z.string().min(32),
  DATABASE_URL: z.string().min(1)
});

let cached: z.infer<typeof Env> | null = null;

export function env() {
  if (cached) return cached;
  const parsed = Env.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('\n  ');
    throw new Error(`Invalid API environment:\n  ${problems}`);
  }
  cached = parsed.data;
  return cached;
}
