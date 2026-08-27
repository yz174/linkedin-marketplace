import {
  canManageTeam,
  ChangeRole,
  CreateInvite,
  InvitePreview,
  Team,
  type MemberRole,
  type WorkspaceInvite
} from '@lm/contracts';
import { users, workspaceInvites, workspaceMembers, workspaces } from '@lm/db';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { accountTypeFor, db } from '../auth';
import { env } from '../env';
import { session } from '../guards';
import { HttpError } from '../http';
import { INVITE_TTL_MS, issueInviteToken, readInviteToken } from '../invite-token';
import { membershipFor } from './brand-routes';

const InviteId = z.object({ id: z.string().uuid() });
const MemberId = z.object({ userId: z.string() });
const AcceptInvite = z.object({ token: z.string().min(1).max(500) });
const PreviewQuery = z.object({ token: z.string().min(1).max(500) });

export function workspaceRoutes(instance: FastifyInstance) {
  const app = instance.withTypeProvider<ZodTypeProvider>();

  app.get('/team', { schema: { response: { 200: Team } } }, async (request) => {
    const { workspaceId, role } = await requireMembership(request);
    const workspace = await workspaceById(workspaceId);

    return {
      workspaceId,
      workspaceName: workspace.name,
      yourRole: role,
      members: await membersOf(workspaceId),
      invites: await pendingInvitesOf(workspaceId)
    };
  });

  app.post('/invites', { schema: { body: CreateInvite } }, async (request) => {
    const { workspaceId } = await requireManager(request);
    const { email, role } = request.body;
    const invitedBy = session(request).userId;

    const accountType = await accountTypeFor(email);
    if (accountType && accountType !== 'brand') {
      throw new HttpError(
        409,
        'email_belongs_to_other_account_type',
        `${email} is registered as a ${accountType} account and cannot join a brand workspace.`
      );
    }

    if (await isMember(workspaceId, email)) {
      throw new HttpError(409, 'already_in_workspace', `${email} is already in this workspace.`);
    }

    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    const [row] = await db
      .insert(workspaceInvites)
      .values({ workspaceId, email, role, invitedBy, expiresAt })
      .onConflictDoUpdate({
        target: [workspaceInvites.workspaceId, workspaceInvites.email],
        targetWhere: and(isNull(workspaceInvites.acceptedAt), isNull(workspaceInvites.revokedAt)),
        set: { role, invitedBy, expiresAt }
      })
      .returning();

    return shapeInvite(row!, await inviterName(row!.invitedBy));
  });

  app.post('/invites/:id/revoke', { schema: { params: InviteId } }, async (request) => {
    const { workspaceId } = await requireManager(request);

    const [row] = await db
      .update(workspaceInvites)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(workspaceInvites.id, request.params.id),
          eq(workspaceInvites.workspaceId, workspaceId),
          isNull(workspaceInvites.acceptedAt),
          isNull(workspaceInvites.revokedAt)
        )
      )
      .returning({ id: workspaceInvites.id });

    if (!row) throw new HttpError(404, 'not_found', 'That invite is no longer pending.');
    return { ok: true };
  });

  app.post(
    '/members/:userId/role',
    { schema: { params: MemberId, body: ChangeRole } },
    async (request) => {
      const workspaceId = await requireOwner(request, request.params.userId);

      const [row] = await db
        .update(workspaceMembers)
        .set({ role: request.body.role })
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspaceId),
            eq(workspaceMembers.userId, request.params.userId)
          )
        )
        .returning({ role: workspaceMembers.role });

      if (!row) throw new HttpError(404, 'not_found', 'That person is not in this workspace.');
      return { ok: true };
    }
  );

  app.post('/members/:userId/remove', { schema: { params: MemberId } }, async (request) => {
    const workspaceId = await requireOwner(request, request.params.userId);

    const [row] = await db
      .delete(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, request.params.userId)
        )
      )
      .returning({ userId: workspaceMembers.userId });

    if (!row) throw new HttpError(404, 'not_found', 'That person is not in this workspace.');
    return { ok: true };
  });

  app.post('/invites/accept', { schema: { body: AcceptInvite } }, async (request) => {
    const { userId, email } = session(request);
    const invite = await pendingInvite(request.body.token);

    if (invite.email.toLowerCase() !== email.toLowerCase()) {
      throw new HttpError(403, 'invalid_invite', 'That invite was sent to a different email.');
    }

    if (await membershipFor(userId)) {
      throw new HttpError(
        409,
        'already_in_workspace',
        'You already belong to a workspace. Leave it before joining another.'
      );
    }

    await db.transaction(async (tx) => {
      await tx
        .insert(workspaceMembers)
        .values({ workspaceId: invite.workspaceId, userId, role: invite.role });
      await tx
        .update(workspaceInvites)
        .set({ acceptedAt: new Date() })
        .where(eq(workspaceInvites.id, invite.id));
    });

    return { workspaceId: invite.workspaceId };
  });
}

export function invitePreviewRoute(instance: FastifyInstance) {
  const app = instance.withTypeProvider<ZodTypeProvider>();

  app.get(
    '/invites/preview',
    { schema: { querystring: PreviewQuery, response: { 200: InvitePreview } } },
    async (request) => {
      const invite = await pendingInvite(request.query.token);
      const workspace = await workspaceById(invite.workspaceId);

      return {
        workspaceName: workspace.name,
        email: invite.email,
        role: inviteRole(invite.role),
        invitedByName: await inviterName(invite.invitedBy),
        expiresAt: invite.expiresAt.toISOString()
      };
    }
  );
}

async function pendingInvite(token: string) {
  const read = readInviteToken(token);
  if (!read) throw new HttpError(404, 'invalid_invite', 'That invite link is expired or invalid.');

  const [invite] = await db
    .select()
    .from(workspaceInvites)
    .where(
      and(
        eq(workspaceInvites.id, read.inviteId),
        isNull(workspaceInvites.acceptedAt),
        isNull(workspaceInvites.revokedAt)
      )
    )
    .limit(1);

  if (!invite || invite.expiresAt.getTime() < Date.now()) {
    throw new HttpError(404, 'invalid_invite', 'That invite link is expired or invalid.');
  }
  return invite;
}

async function requireMembership(request: FastifyRequest) {
  const membership = await membershipFor(session(request).userId);
  if (!membership) throw new HttpError(404, 'not_found', 'Finish onboarding first.');
  return membership;
}

async function requireManager(request: FastifyRequest) {
  const membership = await requireMembership(request);
  if (!canManageTeam(membership.role)) {
    throw new HttpError(403, 'insufficient_role', 'Only an owner or an admin can manage the team.');
  }
  return membership;
}

async function requireOwner(request: FastifyRequest, targetUserId: string) {
  const membership = await requireMembership(request);
  if (membership.role !== 'owner') {
    throw new HttpError(403, 'insufficient_role', 'Only the workspace owner can do that.');
  }
  if (targetUserId === session(request).userId) {
    throw new HttpError(403, 'insufficient_role', 'The owner cannot change or remove themselves.');
  }
  return membership.workspaceId;
}

async function workspaceById(workspaceId: string) {
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  if (!workspace) throw new HttpError(404, 'not_found', 'That workspace no longer exists.');
  return workspace;
}

async function membersOf(workspaceId: string) {
  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      role: workspaceMembers.role,
      joinedAt: workspaceMembers.createdAt
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .orderBy(asc(workspaceMembers.createdAt));

  return rows.map((row) => ({ ...row, joinedAt: row.joinedAt.toISOString() }));
}

async function pendingInvitesOf(workspaceId: string) {
  const rows = await db
    .select({
      id: workspaceInvites.id,
      email: workspaceInvites.email,
      role: workspaceInvites.role,
      expiresAt: workspaceInvites.expiresAt,
      createdAt: workspaceInvites.createdAt,
      invitedByName: users.name
    })
    .from(workspaceInvites)
    .leftJoin(users, eq(users.id, workspaceInvites.invitedBy))
    .where(
      and(
        eq(workspaceInvites.workspaceId, workspaceId),
        isNull(workspaceInvites.acceptedAt),
        isNull(workspaceInvites.revokedAt)
      )
    )
    .orderBy(desc(workspaceInvites.createdAt));

  return rows
    .filter((row) => row.expiresAt.getTime() >= Date.now())
    .map((row) => shapeInvite(row, row.invitedByName ?? 'A teammate'));
}

function shapeInvite(
  row: { id: string; email: string; role: MemberRole; expiresAt: Date; createdAt: Date },
  invitedByName: string
): WorkspaceInvite {
  return {
    id: row.id,
    email: row.email,
    role: inviteRole(row.role),
    invitedByName,
    acceptUrl: `${env().WEB_ORIGIN}/brand/invite/${issueInviteToken(row.id, row.expiresAt)}`,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString()
  };
}

function inviteRole(role: MemberRole) {
  if (role === 'owner') throw new HttpError(500, 'validation_failed', 'An invite cannot be owner.');
  return role;
}

async function isMember(workspaceId: string, email: string) {
  const [row] = await db
    .select({ userId: users.id })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(users.email, email)))
    .limit(1);
  return Boolean(row);
}

async function inviterName(invitedBy: string | null) {
  if (!invitedBy) return 'A teammate';
  const [row] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, invitedBy))
    .limit(1);
  return row?.name ?? 'A teammate';
}
