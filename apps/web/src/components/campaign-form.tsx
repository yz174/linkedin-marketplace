'use client';

import type { CampaignDraft, DraftCampaignResponse } from '@lm/contracts';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Origin = { source: 'ai' | 'url' | 'document'; sourceRef?: string };

const ORIGIN_OF: Record<DraftCampaignResponse['source'], Origin['source']> = {
  url: 'url',
  document: 'document',
  pasted: 'ai'
};

function uploadBody(data: FormData) {
  const body = new FormData();
  body.append('file', data.get('file') as File);
  return body;
}

export function CampaignForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<'url' | 'paste' | 'file'>('url');
  const [reading, setReading] = useState(false);
  const [draft, setDraft] = useState<CampaignDraft | null>(null);
  const [origin, setOrigin] = useState<Origin>({ source: 'ai' });
  const [read, setRead] = useState<{ chars: number; model: string } | null>(null);
  const [version, setVersion] = useState(0);

  async function readSource(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReading(true);
    setError(null);

    const data = new FormData(event.currentTarget);

    const response =
      mode === 'file'
        ? await fetch('/bff/brand/campaigns/draft/document', {
            method: 'POST',
            credentials: 'include',
            body: uploadBody(data)
          })
        : await fetch('/bff/brand/campaigns/draft', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(
              mode === 'url'
                ? { url: String(data.get('sourceUrl') ?? '') }
                : { pastedBrief: String(data.get('pastedBrief') ?? '') }
            )
          });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      setError(payload?.message ?? 'Could not read that source.');
      setReading(false);
      return;
    }

    const result = (await response.json()) as DraftCampaignResponse;
    setDraft(result.draft);
    setOrigin({ source: ORIGIN_OF[result.source], sourceRef: result.sourceRef });
    setRead({ chars: result.charsRead, model: result.model });
    setVersion((current) => current + 1);
    setReading(false);
  }

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
        source: origin.source,
        ...(origin.sourceRef ? { sourceRef: origin.sourceRef } : {})
      })
    });

    if (response.ok) {
      close();
      router.refresh();
      setBusy(false);
      return;
    }

    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    setError(payload?.message ?? 'Could not create that campaign.');
    setBusy(false);
  }

  function close() {
    setOpen(false);
    setDraft(null);
    setRead(null);
    setError(null);
    setOrigin({ source: 'ai' });
  }

  if (!open) {
    return (
      <button className="btn" onClick={() => setOpen(true)}>
        New campaign
      </button>
    );
  }

  return (
    <div className="card" style={{ padding: 'var(--s5)', marginBottom: 'var(--s4)' }}>
      {error ? <div className="alert">{error}</div> : null}

      <form onSubmit={readSource} style={{ marginBottom: 'var(--s4)' }}>
        <div className="seg" style={{ marginBottom: 'var(--s3)' }}>
          <button type="button" aria-selected={mode === 'url'} onClick={() => setMode('url')}>
            From a page
          </button>
          <button type="button" aria-selected={mode === 'paste'} onClick={() => setMode('paste')}>
            From a brief
          </button>
          <button type="button" aria-selected={mode === 'file'} onClick={() => setMode('file')}>
            From a file
          </button>
        </div>

        {mode === 'url' ? (
          <label className="field">
            <span>Product or launch page</span>
            <input
              name="sourceUrl"
              type="url"
              required
              placeholder="https://yourcompany.com/pricing"
            />
          </label>
        ) : mode === 'file' ? (
          <label className="field">
            <span>Brief as a PDF, DOCX, or PPTX, up to 10MB</span>
            <input name="file" type="file" required accept=".pdf,.docx,.pptx" />
          </label>
        ) : (
          <label className="field">
            <span>Paste the brief you already have</span>
            <textarea
              className="area"
              name="pastedBrief"
              rows={4}
              required
              minLength={50}
              placeholder="What is launching, who it is for, and what the post should argue."
            />
          </label>
        )}

        <div className="collab-acts">
          <button className="btn ghost" type="submit" disabled={reading}>
            {reading ? 'Reading…' : 'Draft from this'}
          </button>
          {read ? (
            <span className="t-xs muted">
              {read.chars.toLocaleString('en-IE')} characters read by {read.model}. Edit anything
              below before you save.
            </span>
          ) : null}
        </div>
      </form>

      <div className="card-sep" />

      <form key={version} onSubmit={submit} style={{ paddingTop: 'var(--s4)' }}>
        <label className="field">
          <span>Title</span>
          <input name="title" required defaultValue={draft?.title ?? ''} placeholder="Q3 Pipeline Push" />
        </label>

        <label className="field">
          <span>Objective, what should a reader do after seeing the post</span>
          <textarea
            className="area"
            name="objective"
            rows={2}
            required
            minLength={10}
            defaultValue={draft?.objective ?? ''}
            placeholder="Convince heads of talent that a four week loop costs more than a bad hire."
          />
        </label>

        <label className="field">
          <span>Key messages, one per line</span>
          <textarea
            className="area"
            name="keyMessages"
            rows={3}
            defaultValue={draft?.keyMessages.join('\n') ?? ''}
            placeholder={'Loop length is a decision-rights problem.\nStructure in a spreadsheet is structure nobody applies.'}
          />
        </label>

        <label className="field">
          <span>Do not, one per line</span>
          <textarea
            className="area"
            name="doNot"
            rows={2}
            defaultValue={draft?.doNot.join('\n') ?? ''}
            placeholder={'No feature lists.\nDo not open with the product.'}
          />
        </label>

        <label className="field">
          <span>Deliverable</span>
          <input
            name="deliverable"
            required
            defaultValue={draft?.deliverable ?? 'One LinkedIn post in your own voice, with a tracked link.'}
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
          <button className="btn ghost" type="button" onClick={close}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
