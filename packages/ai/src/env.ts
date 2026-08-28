import { z } from 'zod';

const Env = z.object({
  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_MODEL: z.string().min(1).default('minimax/minimax-m3:free'),
  OPENROUTER_FALLBACKS: z
    .string()
    .default('minimax/minimax-m3,google/gemini-2.5-flash')
    .transform((s) => s.split(',').map((m) => m.trim()).filter(Boolean)),
  GEMINI_API_KEY: z.string().min(1),
  SCRAPECREATORS_API_KEY: z.string().min(1).optional(),
  LINKEDIN_PROVIDER: z.enum(['scrapecreators', 'manual']).default('scrapecreators'),
  LINKEDIN_ENRICH_POSTS: z.coerce.number().int().min(0).max(20).default(5)
});

let cached: z.infer<typeof Env> | null = null;

export function env() {
  if (cached) return cached;
  const parsed = Env.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Invalid AI environment: ${missing}`);
  }
  cached = parsed.data;
  return cached;
}
