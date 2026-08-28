'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Mode = 'login' | 'signup';

const OTHER_SIDE: Record<'brand' | 'creator', 'brand' | 'creator'> = {
  brand: 'creator',
  creator: 'brand'
};

export function AuthForm({
  side,
  mode,
  landing,
  onAuthed,
  onSwitchMode
}: {
  side: 'brand' | 'creator';
  mode: Mode;
  landing: string;
  onAuthed?: () => void;
  onSwitchMode?: (mode: Mode) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const data = new FormData(event.currentTarget);
    const body: Record<string, string> = {
      email: String(data.get('email') ?? ''),
      password: String(data.get('password') ?? '')
    };
    if (mode === 'signup') body.name = String(data.get('name') ?? '');

    const response = await fetch(`/bff/${side}/${mode === 'signup' ? 'signup' : 'login'}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include'
    });

    if (response.ok) {
      if (onAuthed) {
        onAuthed();
        return;
      }
      router.push(landing);
      router.refresh();
      return;
    }

    const payload = (await response.json().catch(() => null)) as
      | { code?: string; message?: string }
      | null;
    setError({
      code: payload?.code ?? 'unknown',
      message: payload?.message ?? 'Something went wrong. Try again.'
    });
    setBusy(false);
  }

  const other = OTHER_SIDE[side];
  const wrongSide = error?.code === 'email_belongs_to_other_account_type';
  const carry = `?next=${encodeURIComponent(landing)}`;

  return (
    <form className="gate-card" onSubmit={submit}>
      <h1>{mode === 'signup' ? `Create a ${side} account` : `Sign in as a ${side}`}</h1>
      <p className="lede">
        {side === 'brand'
          ? 'Book LinkedIn creators and trace every post back to pipeline.'
          : 'Get offered work that fits what you already write about.'}
      </p>

      <div style={{ marginTop: 'var(--s6)' }}>
        {error ? (
          <div className="alert">
            {error.message}
            {wrongSide ? (
              <>
                {' '}
                <Link href={`/${other}/${mode}`}>Go to the {other} side</Link>
              </>
            ) : null}
          </div>
        ) : null}

        {mode === 'signup' ? (
          <label className="field">
            <span>Your name</span>
            <input name="name" required autoComplete="name" placeholder="Priya Raghunathan" />
          </label>
        ) : null}

        <label className="field">
          <span>Work email</span>
          <input name="email" type="email" required autoComplete="email" placeholder="you@company.com" />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            name="password"
            type="password"
            required
            minLength={12}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            placeholder="At least 12 characters"
          />
        </label>

        <button className="btn block" type="submit" disabled={busy}>
          {busy ? 'Working…' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>

        <p className="gate-foot">
          {mode === 'signup' ? (
            <>
              Already have one?{' '}
              {onSwitchMode ? (
                <button type="button" onClick={() => onSwitchMode('login')}>
                  Sign in
                </button>
              ) : (
                <Link href={`/${side}/login${carry}`}>Sign in</Link>
              )}
            </>
          ) : (
            <>
              No account yet?{' '}
              {onSwitchMode ? (
                <button type="button" onClick={() => onSwitchMode('signup')}>
                  Create one
                </button>
              ) : (
                <Link href={`/${side}/signup${carry}`}>Create one</Link>
              )}
            </>
          )}
        </p>
      </div>
    </form>
  );
}
