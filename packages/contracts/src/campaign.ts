import { z } from 'zod';

export const CampaignDraft = z.object({
  title: z.string().trim().min(1).max(160),
  objective: z.string().trim().min(10).max(1000),
  keyMessages: z.array(z.string().trim().min(1).max(300)).min(1).max(8),
  doNot: z.array(z.string().trim().min(1).max(300)).max(8),
  deliverable: z.string().trim().min(1).max(300)
});
export type CampaignDraft = z.infer<typeof CampaignDraft>;

export const DraftCampaignRequest = z
  .object({
    url: z.string().url().optional(),
    pastedBrief: z.string().trim().min(50).max(20_000).optional()
  })
  .refine((body) => Boolean(body.url) !== Boolean(body.pastedBrief), {
    message: 'Send either a url or a pastedBrief, not both.'
  });
export type DraftCampaignRequest = z.infer<typeof DraftCampaignRequest>;

export const DraftCampaignResponse = z.object({
  draft: CampaignDraft,
  source: z.enum(['url', 'pasted', 'document']),
  sourceRef: z.string(),
  charsRead: z.number().int().nonnegative(),
  model: z.string()
});
export type DraftCampaignResponse = z.infer<typeof DraftCampaignResponse>;
