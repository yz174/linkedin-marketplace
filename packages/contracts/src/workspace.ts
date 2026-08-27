import { z } from 'zod';
import { Email } from './account';

export const MEMBER_ROLES = ['owner', 'admin', 'member'] as const;

export const MemberRole = z.enum(MEMBER_ROLES);
export type MemberRole = z.infer<typeof MemberRole>;

export const InviteRole = z.enum(['admin', 'member']);
export type InviteRole = z.infer<typeof InviteRole>;

export function canManageTeam(role: MemberRole) {
  return role === 'owner' || role === 'admin';
}

export function canEditIcp(role: MemberRole) {
  return role === 'owner' || role === 'admin';
}

export const WorkspaceMember = z.object({
  userId: z.string(),
  name: z.string(),
  email: Email,
  role: MemberRole,
  joinedAt: z.string().datetime()
});
export type WorkspaceMember = z.infer<typeof WorkspaceMember>;

export const WorkspaceInvite = z.object({
  id: z.string().uuid(),
  email: Email,
  role: InviteRole,
  invitedByName: z.string(),
  acceptUrl: z.string().url(),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime()
});
export type WorkspaceInvite = z.infer<typeof WorkspaceInvite>;

export const Team = z.object({
  workspaceId: z.string().uuid(),
  workspaceName: z.string(),
  yourRole: MemberRole,
  members: z.array(WorkspaceMember),
  invites: z.array(WorkspaceInvite)
});
export type Team = z.infer<typeof Team>;

export const CreateInvite = z.object({
  email: Email,
  role: InviteRole
});
export type CreateInvite = z.infer<typeof CreateInvite>;

export const ChangeRole = z.object({
  role: InviteRole
});
export type ChangeRole = z.infer<typeof ChangeRole>;

export const InvitePreview = z.object({
  workspaceName: z.string(),
  email: Email,
  role: InviteRole,
  invitedByName: z.string(),
  expiresAt: z.string().datetime()
});
export type InvitePreview = z.infer<typeof InvitePreview>;
