'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function AcceptInvite({
  token,
  workspaceName,
  signedInAs
}: {
  token: string;
  workspaceName: string;
  signedInAs: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);

    const response = await fetch('/bff/brand/invites/accept', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token })
    });

    if (response.ok) {
      router.push('/brand/catalog');
      router.refresh();
      return;
    }

    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    setError(payload?.message ?? 'Could not join that workspace.');
    setBusy(false);
  }

  return (
    <>
      {error ? <div className="alert">{error}</div> : null}
      <button className="btn block" onClick={accept} disabled={busy}>
        {busy ? 'Joining…' : `Join ${workspaceName}`}
      </button>
      <p className="gate-foot">Joining as {signedInAs}</p>
    </>
  );
}

export function SignOutToSwitch({ invitedEmail }: { invitedEmail: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await fetch('/bff/brand/logout', { method: 'POST', credentials: 'include' });
    router.refresh();
  }

  return (
    <button className="btn block" onClick={signOut} disabled={busy}>
      {busy ? 'Signing out…' : `Sign out and switch to ${invitedEmail}`}
    </button>
  );
}
