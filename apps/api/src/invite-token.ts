import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from './env';

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type InviteToken = {
  inviteId: string;
  expiresAt: number;
};

function sign(payload: string) {
  return createHmac('sha256', env().AUTH_SECRET).update(payload).digest('base64url');
}

export function issueInviteToken(inviteId: string, expiresAt: Date) {
  const payload = [inviteId, expiresAt.getTime()].join('.');
  return `${Buffer.from(payload).toString('base64url')}.${sign(payload)}`;
}

export function readInviteToken(raw: string): InviteToken | null {
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
  if (fields.length !== 2) return null;

  const [inviteId, expiresAt] = fields as [string, string];

  const expiry = Number(expiresAt);
  if (!Number.isFinite(expiry) || expiry < Date.now()) return null;

  return { inviteId, expiresAt: expiry };
}
