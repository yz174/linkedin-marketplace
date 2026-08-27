'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Side = 'brand' | 'creator';

const LABEL: Record<string, string> = {
  accept: 'Accept',
  decline: 'Decline',
  counter: 'Counter',
  share_brief: 'Share the brief',
  submit_draft: 'Submit a draft',
  approve: 'Approve draft',
  request_revision: 'Request changes',
  schedule: 'Schedule',
  publish: 'Mark published',
  cancel: 'Cancel'
};

const PRIMARY = new Set(['accept', 'approve', 'share_brief', 'publish', 'submit_draft']);

type Prompt = { event: 'counter'; field: 'fee' } | { event: 'publish'; field: 'url' } | { event: 'submit_draft'; field: 'draft' };

function promptFor(event: string): Prompt | null {
  if (event === 'counter') return { event: 'counter', field: 'fee' };
  if (event === 'publish') return { event: 'publish', field: 'url' };
  if (event === 'submit_draft') return { event: 'submit_draft', field: 'draft' };
  return null;
}

export function CollabActions({
  id,
  side,
  allowed,
  feeMinor
}: {
  id: string;
  side: Side;
  allowed: string[];
  feeMinor: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [value, setValue] = useState('');

  async function send(event: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setError(null);

    const response = await fetch(`/bff/${side}/collaborations/${id}/move`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ event, ...extra })
    });

    if (response.ok) {
      setPrompt(null);
      setValue('');
      router.refresh();
      setBusy(false);
      return;
    }

    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    setError(payload?.message ?? 'That move was refused.');
    setBusy(false);
  }

  function start(event: string) {
    const needed = promptFor(event);
    if (!needed) return send(event);
    setPrompt(needed);
    setValue(needed.field === 'fee' ? String(Math.round((feeMinor / 100) * 1.15)) : '');
    setError(null);
  }

  function confirm() {
    if (!prompt) return;
    if (prompt.field === 'fee') return send('counter', { feeMinor: Math.round(Number(value) * 100) });
    if (prompt.field === 'url') return send('publish', { postUrl: value });
    return send('submit_draft', { draft: value });
  }

  if (allowed.length === 0) {
    return <span className="t-xs muted">Nothing to do here right now.</span>;
  }

  if (prompt) {
    return (
      <div className="collab-acts stacked">
        {error ? <span className="t-xs" style={{ color: 'var(--down-fg)' }}>{error}</span> : null}
        <label className="field" style={{ margin: 0, flex: 1, minWidth: 220 }}>
          <span>
            {prompt.field === 'fee'
              ? 'Your price, euros'
              : prompt.field === 'url'
                ? 'URL of the live post'
                : 'Your draft'}
          </span>
          {prompt.field === 'draft' ? (
            <textarea className="area" rows={4} value={value} onChange={(e) => setValue(e.target.value)} />
          ) : (
            <input value={value} onChange={(e) => setValue(e.target.value)} />
          )}
        </label>
        <div className="collab-acts">
          <button className="btn sm" disabled={busy || !value.trim()} onClick={confirm}>
            {busy ? 'Sending…' : 'Confirm'}
          </button>
          <button className="btn ghost sm" disabled={busy} onClick={() => setPrompt(null)}>
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="collab-acts">
      {error ? <span className="t-xs" style={{ color: 'var(--down-fg)' }}>{error}</span> : null}
      {allowed
        .filter((event) => event !== 'cancel')
        .map((event) => (
          <button
            key={event}
            className={PRIMARY.has(event) ? 'btn sm' : 'btn ghost sm'}
            disabled={busy}
            onClick={() => start(event)}
          >
            {LABEL[event] ?? event}
          </button>
        ))}
      {allowed.includes('cancel') ? (
        <button className="btn ghost sm" disabled={busy} onClick={() => send('cancel')}>
          Cancel
        </button>
      ) : null}
    </div>
  );
}
