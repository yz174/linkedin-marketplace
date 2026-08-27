import { z } from 'zod';
import { Actor, CollabState } from './collaboration';

export const STATUS_PROTOCOL_VERSION = 1;
export const STATUS_HEARTBEAT_MS = 25_000;
export const STATUS_RETRY_MS = 3_000;

export const StatusHello = z.object({
  t: z.literal('hello'),
  version: z.literal(STATUS_PROTOCOL_VERSION),
  side: z.enum(['brand', 'creator'])
});

export const CollabChanged = z.object({
  t: z.literal('collab_changed'),
  collaborationId: z.string().uuid(),
  reference: z.string(),
  from: CollabState,
  to: CollabState,
  actor: Actor,
  feeMinor: z.number().int(),
  counterFeeMinor: z.number().int().nullable(),
  updatedAt: z.string().datetime()
});
export type CollabChanged = z.infer<typeof CollabChanged>;

export const StatusFrame = z.discriminatedUnion('t', [StatusHello, CollabChanged]);
export type StatusFrame = z.infer<typeof StatusFrame>;
