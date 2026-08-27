import { z } from 'zod';
import { Actor } from './collaboration';

export const PROTOCOL_VERSION = 1;

export const MAX_BODY_CHARS = 4000;
export const MAX_REPLAY = 500;
export const HEARTBEAT_MS = 30_000;
export const LIVENESS_MS = HEARTBEAT_MS * 2 + 5_000;
export const MAX_BUFFERED_BYTES = 1_000_000;

export const CloseCode = {
  unauthenticated: 4401,
  forbidden: 4403,
  notFound: 4404,
  protocol: 4400,
  backpressure: 4408,
  timeout: 4409,
  serverShutdown: 4500
} as const;

export const Message = z.object({
  id: z.string().uuid(),
  collaborationId: z.string().uuid(),
  seq: z.number().int().positive(),
  sender: Actor,
  senderUserId: z.string().uuid().nullable(),
  senderName: z.string(),
  body: z.string().min(1).max(MAX_BODY_CHARS),
  createdAt: z.string().datetime()
});
export type Message = z.infer<typeof Message>;

export const ClientSend = z.object({
  t: z.literal('send'),
  id: z.string().uuid(),
  body: z.string().trim().min(1).max(MAX_BODY_CHARS)
});

export const ClientPing = z.object({ t: z.literal('ping') });

export const ClientFrame = z.discriminatedUnion('t', [ClientSend, ClientPing]);
export type ClientFrame = z.infer<typeof ClientFrame>;

export const ServerReady = z.object({
  t: z.literal('ready'),
  version: z.literal(PROTOCOL_VERSION),
  collaborationId: z.string().uuid(),
  you: Actor,
  lastSeq: z.number().int().nonnegative(),
  replayed: z.number().int().nonnegative(),
  truncated: z.boolean()
});

export const ServerMessage = z.object({ t: z.literal('message'), message: Message });

export const ServerAck = z.object({
  t: z.literal('ack'),
  id: z.string().uuid(),
  seq: z.number().int().positive()
});

export const ServerPong = z.object({ t: z.literal('pong') });

export const WsErrorCode = z.enum([
  'bad_frame',
  'body_too_long',
  'rate_limited',
  'not_participant',
  'send_failed'
]);
export type WsErrorCode = z.infer<typeof WsErrorCode>;

export const ServerError = z.object({
  t: z.literal('error'),
  code: WsErrorCode,
  message: z.string(),
  id: z.string().uuid().optional()
});

export const ServerFrame = z.discriminatedUnion('t', [
  ServerReady,
  ServerMessage,
  ServerAck,
  ServerPong,
  ServerError
]);
export type ServerFrame = z.infer<typeof ServerFrame>;

export const MessagePage = z.object({
  items: z.array(Message),
  lastSeq: z.number().int().nonnegative(),
  truncated: z.boolean()
});
export type MessagePage = z.infer<typeof MessagePage>;
