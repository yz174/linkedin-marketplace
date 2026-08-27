'use client';

import { canManageTeam, type Team } from '@lm/contracts';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { initials } from '@/lib/format';

const ROLE_NOTE: Record<string, string> = {
  owner: 'Full access. Only the owner changes roles or removes people.',
  admin: 'Everything the owner can do except changing roles and removing people.',
  member: 'Campaigns, catalog, collaborations, and messenger. Cannot invite or edit the ICP.'
};

export function TeamPanel({ team }: { team: Team }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [copied, setCopied] = useState<string | null>(null);

  const manages = canManageTeam(team.yourRole);
  const owns = team.yourRole === 'owner';

  async function send(path: string, body: unknown, key: string) {
    setBusy(key);
    setError(null);

    const response = await fetch(`/bff/brand${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body ?? {})
    });

    setBusy(null);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      setError(payload?.message ?? 'That did not work. Try again.');
      return false;
    }

    router.refresh();
    return true;
  }

  async function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await send('/invites', { email, role }, 'invite')) setEmail('');
  }

  async function copy(url: string, id: string) {
    await navigator.clipboard.writeText(url);
    setCopied(id);
  }

  return (
    <>
      {error ? <div className="alert">{error}</div> : null}

      <article className="card" style={{ marginBottom: 'var(--s5)' }}>
        <div className="card-head">
          <h3>Workspace</h3>
          <div className="acts">
            <span className={team.yourRole === 'member' ? 'tag grey' : 'tag'}>
              You are {team.yourRole === 'admin' ? 'an' : 'the'} {team.yourRole}
            </span>
          </div>
        </div>
        <div className="card-sep" />
        <div className="card-body" style={{ paddingTop: 'var(--s4)' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 26 }}>
            {team.workspaceName}
          </h2>
          <p className="t-sm muted" style={{ marginTop: 'var(--s2)', lineHeight: 1.55 }}>
            {ROLE_NOTE[team.yourRole]}
          </p>
        </div>
      </article>

      <article className="card" style={{ marginBottom: 'var(--s5)' }}>
        <div className="card-head">
          <h3>Members</h3>
          <div className="acts">
            <span className="t-xs muted">{team.members.length} in this workspace</span>
          </div>
        </div>
        <div className="card-sep" />
        <div className="card-body" style={{ paddingTop: 'var(--s3)' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Person</th>
                <th>Role</th>
                <th className="r">Joined</th>
                {owns ? <th className="r">Action</th> : null}
              </tr>
            </thead>
            <tbody>
              {team.members.map((member) => (
                <tr key={member.userId}>
                    <td>
                      <span className="who">
                        <span className="av sm">{initials(member.name)}</span>
                        <span>
                          <span className="nm">{member.name}</span>
                          <br />
                          <span className="sub">{member.email}</span>
                        </span>
                      </span>
                    </td>
                    <td>
                      {owns && member.role !== 'owner' ? (
                        <label className="field" style={{ marginBottom: 0, width: 130 }}>
                          <select
                            value={member.role}
                            disabled={busy === member.userId}
                            onChange={(event) =>
                              send(
                                `/members/${member.userId}/role`,
                                { role: event.target.value },
                                member.userId
                              )
                            }
                          >
                            <option value="admin">admin</option>
                            <option value="member">member</option>
                          </select>
                        </label>
                      ) : (
                        <span className={member.role === 'member' ? 'tag grey' : 'tag'}>
                          {member.role}
                        </span>
                      )}
                    </td>
                    <td className="r num">{new Date(member.joinedAt).toLocaleDateString('en-IE')}</td>
                    {owns ? (
                      <td className="r">
                        {member.role === 'owner' ? (
                          <span className="t-xs muted">—</span>
                        ) : (
                          <button
                            className="btn ghost sm"
                            disabled={busy === member.userId}
                            onClick={() => send(`/members/${member.userId}/remove`, {}, member.userId)}
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    ) : null}
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="card">
        <div className="card-head">
          <h3>Invites</h3>
          <div className="acts">
            <span className="t-xs muted">Links expire after seven days</span>
          </div>
        </div>
        <div className="card-sep" />
        <div className="card-body" style={{ paddingTop: 'var(--s4)' }}>
          {manages ? (
            <form onSubmit={invite} style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'end' }}>
              <label className="field" style={{ flex: 1, marginBottom: 0 }}>
                <span>Work email</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="teammate@company.com"
                />
              </label>
              <label className="field" style={{ width: 160, marginBottom: 0 }}>
                <span>Role</span>
                <select value={role} onChange={(event) => setRole(event.target.value as 'admin' | 'member')}>
                  <option value="member">member</option>
                  <option value="admin">admin</option>
                </select>
              </label>
              <button className="btn" type="submit" disabled={busy === 'invite'}>
                {busy === 'invite' ? 'Working…' : 'Invite'}
              </button>
            </form>
          ) : (
            <p className="t-sm muted">Only an owner or an admin can invite people.</p>
          )}

          {team.invites.length === 0 ? (
            <p className="note" style={{ marginTop: 'var(--s4)' }}>
              No invites are pending. We do not send email yet, so copy the link and pass it on
              yourself.
            </p>
          ) : (
            <table className="tbl" style={{ marginTop: 'var(--s5)' }}>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th className="r">Expires</th>
                  {manages ? <th className="r">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {team.invites.map((pending) => (
                  <tr key={pending.id}>
                    <td>
                      <span className="nm">{pending.email}</span>
                      <br />
                      <span className="sub">Invited by {pending.invitedByName}</span>
                    </td>
                    <td>
                      <span className={pending.role === 'member' ? 'tag grey' : 'tag'}>
                        {pending.role}
                      </span>
                    </td>
                    <td className="r num">
                      {new Date(pending.expiresAt).toLocaleDateString('en-IE')}
                    </td>
                    {manages ? (
                      <td className="r">
                        <span
                          style={{ display: 'inline-flex', gap: 'var(--s2)', justifyContent: 'flex-end' }}
                        >
                          <button
                            className="btn ghost sm"
                            onClick={() => copy(pending.acceptUrl, pending.id)}
                          >
                            {copied === pending.id ? 'Copied' : 'Copy link'}
                          </button>
                          <button
                            className="btn ghost sm"
                            disabled={busy === pending.id}
                            onClick={() => send(`/invites/${pending.id}/revoke`, {}, pending.id)}
                          >
                            Revoke
                          </button>
                        </span>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </article>
    </>
  );
}
