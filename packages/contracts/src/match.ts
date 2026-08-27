import { z } from 'zod';
import { CreatorCard } from './creator';

export const MATCH_COMPONENTS = [
  'tagAffinity',
  'semanticFit',
  'audienceFit',
  'reliability',
  'availability'
] as const;

export const MatchComponent = z.enum(MATCH_COMPONENTS);
export type MatchComponent = z.infer<typeof MatchComponent>;

export const MatchWeights = z.object({
  tagAffinity: z.number().min(0).max(1),
  semanticFit: z.number().min(0).max(1),
  audienceFit: z.number().min(0).max(1),
  reliability: z.number().min(0).max(1),
  availability: z.number().min(0).max(1)
});
export type MatchWeights = z.infer<typeof MatchWeights>;

export const DEFAULT_WEIGHTS: MatchWeights = {
  tagAffinity: 0.4,
  semanticFit: 0.3,
  audienceFit: 0.15,
  reliability: 0.1,
  availability: 0.05
};

export const MatchReason = z.object({
  component: MatchComponent,
  label: z.string(),
  strong: z.boolean()
});
export type MatchReason = z.infer<typeof MatchReason>;

export const MatchComponents = z.object({
  tagAffinity: z.number().min(0).max(1),
  semanticFit: z.number().min(0).max(1),
  audienceFit: z.number().min(0).max(1),
  reliability: z.number().min(0).max(1),
  availability: z.number().min(0).max(1)
});
export type MatchComponents = z.infer<typeof MatchComponents>;

export const MatchScore = z.object({
  score: z.number().min(0).max(100),
  components: MatchComponents,
  reasons: z.array(MatchReason)
});
export type MatchScore = z.infer<typeof MatchScore>;

export const MatchedCreator = z.object({
  creator: CreatorCard,
  match: MatchScore
});
export type MatchedCreator = z.infer<typeof MatchedCreator>;

export const CatalogQuery = z.object({
  view: z.enum(['matched', 'all']).default('matched'),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  cursor: z.string().optional(),
  weights: z
    .string()
    .transform((raw, ctx) => {
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'weights must be JSON' });
        return z.NEVER;
      }
    })
    .pipe(MatchWeights)
    .optional()
});
export type CatalogQuery = z.infer<typeof CatalogQuery>;

export const CatalogResponse = z.object({
  items: z.array(MatchedCreator),
  nextCursor: z.string().nullable(),
  total: z.number().int().nonnegative()
});
export type CatalogResponse = z.infer<typeof CatalogResponse>;
