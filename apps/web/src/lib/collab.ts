import { z } from 'zod';

export const CollabRow = z.object({
  id: z.string().uuid(),
  reference: z.string(),
  state: z.string(),
  feeMinor: z.number(),
  counterFeeMinor: z.number().nullable(),
  counterRounds: z.number(),
  lastCounterBy: z.string().nullable(),
  trackedLink: z.string().nullable(),
  postUrl: z.string().nullable(),
  draft: z.string().nullable(),
  publishBy: z.string().nullable(),
  invitedAt: z.string(),
  creatorName: z.string(),
  campaignTitle: z.string(),
  allowed: z.array(z.string())
});
export type CollabRow = z.infer<typeof CollabRow>;

export const CollabList = z.object({ items: z.array(CollabRow) });

export const STATE_LABEL: Record<string, string> = {
  invited: 'Invited',
  countered: 'Countered',
  accepted: 'Accepted',
  brief_shared: 'Brief shared',
  draft_submitted: 'Draft submitted',
  revision_requested: 'Changes requested',
  draft_approved: 'Approved',
  scheduled: 'Scheduled',
  published: 'Published',
  verified: 'Verified',
  paid: 'Paid',
  declined: 'Declined',
  expired: 'Expired',
  cancelled: 'Cancelled'
};

export const STATE_TONE: Record<string, string> = {
  invited: 'warn',
  countered: 'warn',
  accepted: 'info',
  brief_shared: 'info',
  draft_submitted: 'info',
  revision_requested: 'warn',
  draft_approved: 'info',
  scheduled: 'info',
  published: 'ok',
  verified: 'ok',
  paid: 'ok'
};

export const NEEDS_YOU: Record<string, string[]> = {
  brand: ['countered', 'draft_submitted'],
  creator: ['invited', 'brief_shared', 'revision_requested', 'draft_approved', 'scheduled']
};
