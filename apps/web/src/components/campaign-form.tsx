'use client';

import type { CampaignDraft, DraftCampaignResponse } from '@lm/contracts';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

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
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>
        New campaign
      </button>
      {open ? <Drawer onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function Drawer({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [entered, setEntered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<'url' | 'paste' | 'file'>('url');
  const [reading, setReading] = useState(false);
  const [draft, setDraft] = useState<CampaignDraft | null>(null);
  const [origin, setOrigin] = useState<Origin>({ source: 'ai' });
  const [read, setRead] = useState<{ chars: number; model: string } | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function close() {
    setEntered(false);
    window.setTimeout(onClose, 240);
  }

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
    setVersion((v) => v + 1);
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
      router.refresh();
      close();
      return;
    }

    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    setError(payload?.message ?? 'Could not create that campaign.');
    setBusy(false);
  }

  return createPortal(
    <>
      <div className="drawer-scrim" onClick={close} />
      <aside className={`drawer ${entered ? 'is-in' : ''}`} role="dialog" aria-label="New campaign">
        <div className="drawer-head">
          <h2>New campaign</h2>
          <button type="button" className="drawer-close" onClick={close} aria-label="Close">
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
              <path
                d="M5 5l10 10M15 5L5 15"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="drawer-body">
          {error ? <div className="alert">{error}</div> : null}

          <form onSubmit={readSource} className="drawer-source">
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
              <label className="field" style={{ marginBottom: 'var(--s3)' }}>
                <span>Product or launch page</span>
                <input
                  name="sourceUrl"
                  type="url"
                  required
                  placeholder="https://yourcompany.com/pricing"
                />
              </label>
            ) : mode === 'file' ? (
              <label className="field" style={{ marginBottom: 'var(--s3)' }}>
                <span>Brief as a PDF, DOCX, or PPTX, up to 10MB</span>
                <input name="file" type="file" required accept=".pdf,.docx,.pptx" />
              </label>
            ) : (
              <label className="field" style={{ marginBottom: 'var(--s3)' }}>
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

            <button className="btn ghost sm" type="submit" disabled={reading}>
              {reading ? 'Reading…' : 'Draft from this'}
            </button>
            {read ? (
              <p className="drawer-read">
                {read.chars.toLocaleString('en-IE')} characters read by {read.model}. Edit anything
                below before you save.
              </p>
            ) : null}
          </form>

          <form key={version} id="campaign-create" onSubmit={submit}>
            <label className="field">
              <span>Title</span>
              <input
                name="title"
                required
                defaultValue={draft?.title ?? ''}
                placeholder="Q3 Pipeline Push"
              />
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
                placeholder={
                  'Loop length is a decision-rights problem.\nStructure in a spreadsheet is structure nobody applies.'
                }
              />
            </label>

            <label className="field">
              <span>Won&rsquo;t do, one per line</span>
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
                defaultValue={
                  draft?.deliverable ?? 'One LinkedIn post in your own voice, with a tracked link.'
                }
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
          </form>
        </div>

        <div className="drawer-foot">
          <button className="btn" type="submit" form="campaign-create" disabled={busy}>
            {busy ? 'Creating…' : 'Create campaign'}
          </button>
          <button className="btn ghost" type="button" onClick={close}>
            Cancel
          </button>
        </div>
      </aside>
    </>,
    document.body
  );
}
