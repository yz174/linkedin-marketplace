import { z } from 'zod';

export const Money = z.object({
  amountMinor: z.number().int().min(1).max(100_000_000)
});
export type Money = z.infer<typeof Money>;

export const LedgerEntry = z.object({
  id: z.string().uuid(),
  kind: z.enum(['topup', 'hold', 'release', 'refund', 'withdraw']),
  amountMinor: z.number().int(),
  reference: z.string().nullable(),
  createdAt: z.string().datetime()
});
export type LedgerEntry = z.infer<typeof LedgerEntry>;

export const BrandWallet = z.object({
  balanceMinor: z.number().int(),
  heldMinor: z.number().int(),
  entries: z.array(LedgerEntry)
});
export type BrandWallet = z.infer<typeof BrandWallet>;

export const CreatorWallet = z.object({
  balanceMinor: z.number().int(),
  pendingMinor: z.number().int(),
  entries: z.array(LedgerEntry)
});
export type CreatorWallet = z.infer<typeof CreatorWallet>;

export const CampaignAnalytics = z.object({
  campaignId: z.string().uuid(),
  title: z.string(),
  assignments: z.number().int(),
  published: z.number().int(),
  spendMinor: z.number().int(),
  committedMinor: z.number().int(),
  clicks: z.number().int(),
  visitors: z.number().int(),
  costPerClickMinor: z.number().int().nullable()
});
export type CampaignAnalytics = z.infer<typeof CampaignAnalytics>;

export const BrandAnalytics = z.object({
  campaigns: z.array(CampaignAnalytics),
  totals: z.object({
    spendMinor: z.number().int(),
    committedMinor: z.number().int(),
    clicks: z.number().int(),
    visitors: z.number().int(),
    costPerClickMinor: z.number().int().nullable()
  })
});
export type BrandAnalytics = z.infer<typeof BrandAnalytics>;
