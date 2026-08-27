'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function CampaignForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const data = new FormData(event.currentTarget);
    const lines = (name: string) =>
      String(data.get(name) ?? '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

    const response = await fetch('/bff/brand/campaigns', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        title: String(data.get('title') ?? ''),
        objective: String(data.get('objective') ?? ''),
        keyMessages: lines('keyMessages'),
        doNot: lines('doNot'),
        deliverable: String(data.get('deliverable') ?? ''),
        budgetMinMinor: Math.round(Number(data.get('budgetMin') ?? 0) * 100),
        budgetMaxMinor: Math.round(Number(data.get('budgetMax') ?? 0) * 100),
        source: 'ai'
      })
    });

    if (response.ok) {
      setOpen(false);
      router.refresh();
      setBusy(false);
      return;
    }

    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    setError(payload?.message ?? 'Could not create that campaign.');
    setBusy(false);
  }

  if (!open) {
    return (
      <button className="btn" onClick={() => setOpen(true)}>
        New campaign
      </button>
    );
  }

  return (
    <form className="card" style={{ padding: 'var(--s5)', marginBottom: 'var(--s4)' }} onSubmit={submit}>
      {error ? <div className="alert">{error}</div> : null}

      <label className="field">
        <span>Title</span>
        <input name="title" required placeholder="Q3 Pipeline Push" />
      </label>

      <label className="field">
        <span>Objective, what should a reader do after seeing the post</span>
        <textarea
          className="area"
          name="objective"
          rows={2}
          required
          minLength={10}
          placeholder="Convince heads of talent that a four week loop costs more than a bad hire."
        />
      </label>

      <label className="field">
        <span>Key messages, one per line</span>
        <textarea
          className="area"
          name="keyMessages"
          rows={3}
          placeholder={'Loop length is a decision-rights problem.\nStructure in a spreadsheet is structure nobody applies.'}
        />
      </label>

      <label className="field">
        <span>Do not, one per line</span>
        <textarea
          className="area"
          name="doNot"
          rows={2}
          placeholder={'No feature lists.\nDo not open with the product.'}
        />
      </label>

      <label className="field">
        <span>Deliverable</span>
        <input
          name="deliverable"
          required
          defaultValue="One LinkedIn post in your own voice, with a tracked link."
        />
      </label>

      <div style={{ display: 'flex', gap: 'var(--s3)' }}>
        <label className="field" style={{ flex: 1 }}>
          <span>Budget floor, euros</span>
          <input name="budgetMin" defaultValue="200" inputMode="numeric" />
        </label>
        <label className="field" style={{ flex: 1 }}>
          <span>Budget ceiling, euros</span>
          <input name="budgetMax" defaultValue="450" inputMode="numeric" />
        </label>
      </div>

      <div className="collab-acts">
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create campaign'}
        </button>
        <button className="btn ghost" type="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
