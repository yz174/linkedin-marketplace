import { InvitePreview } from '@lm/contracts';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { z } from 'zod';
import { AcceptInvite, SignOutToSwitch } from '@/components/accept-invite';
import { request } from '@/lib/api';

export const dynamic = 'force-dynamic';

const SignedIn = z.object({ email: z.string().email() });

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const cookie = (await cookies()).toString();

  const invite = await request(
    `/brand/invites/preview?token=${encodeURIComponent(token)}`,
    InvitePreview,
    { cookie }
  ).catch(() => null);

  if (!invite) {
    return (
      <main className="gate">
        <div className="gate-card">
          <div className="gate-mark">L</div>
          <h1>That invite is no longer good</h1>
          <p className="lede">
            Invite links expire after seven days and stop working once they are revoked or used. Ask
            whoever sent it for a fresh one.
          </p>
        </div>
      </main>
    );
  }

  const session = await request('/brand/me', SignedIn, { cookie }).catch(() => null);
  const next = `/brand/invite/${token}`;

  return (
    <main className="gate">
      <div className="gate-card">
        <div className="gate-mark">L</div>
        <h1>Join {invite.workspaceName}</h1>
        <p className="lede">
          {invite.invitedByName} invited {invite.email} to work in {invite.workspaceName} as{' '}
          {invite.role === 'admin' ? 'an admin' : 'a member'}.
        </p>

        <div style={{ marginTop: 'var(--s6)' }}>
          {!session?.email ? (
            <>
              <Link className="btn block" href={`/brand/signup?next=${encodeURIComponent(next)}`}>
                Create an account
              </Link>
              <p className="gate-foot">
                Already have one?{' '}
                <Link href={`/brand/login?next=${encodeURIComponent(next)}`}>Sign in</Link>
              </p>
            </>
          ) : session.email.toLowerCase() === invite.email.toLowerCase() ? (
            <AcceptInvite
              token={token}
              workspaceName={invite.workspaceName}
              signedInAs={session.email}
            />
          ) : (
            <>
              <div className="alert">
                You are signed in as {session.email}, but this invite was sent to {invite.email}.
              </div>
              <SignOutToSwitch invitedEmail={invite.email} />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
