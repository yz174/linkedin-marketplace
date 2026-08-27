import { z } from 'zod';

export const COLLAB_STATES = [
  'invited',
  'countered',
  'accepted',
  'brief_shared',
  'draft_submitted',
  'revision_requested',
  'draft_approved',
  'scheduled',
  'published',
  'verified',
  'paid',
  'declined',
  'expired',
  'cancelled'
] as const;

export const CollabState = z.enum(COLLAB_STATES);
export type CollabState = z.infer<typeof CollabState>;

export const COLLAB_EVENTS = [
  'accept',
  'decline',
  'counter',
  'expire',
  'share_brief',
  'submit_draft',
  'approve',
  'request_revision',
  'schedule',
  'publish',
  'verify',
  'pay',
  'cancel'
] as const;

export const CollabEvent = z.enum(COLLAB_EVENTS);
export type CollabEvent = z.infer<typeof CollabEvent>;

export const Actor = z.enum(['brand', 'creator', 'system']);
export type Actor = z.infer<typeof Actor>;

export const EFFECTS = [
  'hold_escrow',
  'release_escrow',
  'refund_escrow',
  'mint_tracked_link',
  'count_delivery',
  'count_acceptance'
] as const;

export const Effect = z.enum(EFFECTS);
export type Effect = z.infer<typeof Effect>;

export const MAX_COUNTER_ROUNDS = 3;

export const TERMINAL_STATES: readonly CollabState[] = [
  'paid',
  'declined',
  'expired',
  'cancelled'
];
