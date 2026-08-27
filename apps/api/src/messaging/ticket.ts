import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../env';

const TTL_MS = 30_000;

export type Ticket = {
  userId: string;
  accountType: 'brand' | 'creator';
  collaborationId: string;
  expiresAt: number;
};

function sign(payload: string) {
  return createHmac('sha256', env().AUTH_SECRET).update(payload).digest('base64url');
}

export function issueTicket(ticket: Omit<Ticket, 'expiresAt'>) {
  const expiresAt = Date.now() + TTL_MS;
  const payload = [ticket.userId, ticket.accountType, ticket.collaborationId, expiresAt].join('.');
  return { ticket: `${Buffer.from(payload).toString('base64url')}.${sign(payload)}`, expiresAt };
}

export function readTicket(raw: string): Ticket | null {
  const parts = raw.split('.');
  if (parts.length !== 2) return null;

  const [encoded, provided] = parts as [string, string];

  let payload: string;
  try {
    payload = Buffer.from(encoded, 'base64url').toString();
  } catch {
    return null;
  }

  const expected = sign(payload);
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const fields = payload.split('.');
  if (fields.length !== 4) return null;

  const [userId, accountType, collaborationId, expiresAt] = fields as [
    string,
    string,
    string,
    string
  ];

  if (accountType !== 'brand' && accountType !== 'creator') return null;

  const expiry = Number(expiresAt);
  if (!Number.isFinite(expiry) || expiry < Date.now()) return null;

  return { userId, accountType, collaborationId, expiresAt: expiry };
}
