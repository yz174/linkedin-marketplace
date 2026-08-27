'use client';

import { SECTORS, type Icp, type Sector } from '@lm/contracts';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icon } from './icon';

type Stage = 'details' | 'reading' | 'review';

type GenerateResult = {
  icp: Icp;
  source: 'scraped' | 'pasted';
  charsRead: number;
  model: string;
};

const MAX_SECTORS = 3;

export function BrandOnboarding() {
  const router = useRouter();

  const [stage, setStage] = useState<Stage>('details');
  const [companyName, setCompanyName] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [pasted, setPasted] = useState('');
  const [needsPaste, setNeedsPaste] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ source: string; charsRead: number; model: string } | null>(null);

  const [summary, setSummary] = useState('');
  const [points, setPoints] = useState<string[]>([]);
  const [buyerTitles, setBuyerTitles] = useState<string[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [saving, setSaving] = useState(false);

  async function generate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStage('reading');

    const response = await fetch('/bff/brand/icp/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        productUrl,
        pastedPositioning: pasted.trim() ? pasted : undefined
      })
    });

    const payload = (await response.json().catch(() => null)) as
      | (GenerateResult & { code?: string; message?: string })
      | null;

    if (!response.ok) {
      setStage('details');
      if (payload?.code === 'thin_page') {
        setNeedsPaste(true);
        setError(
          'That page returned almost no readable text, which usually means it renders in JavaScript. Paste your positioning instead.'
        );
        return;
      }
      setError(payload?.message ?? 'Could not read that page.');
      return;
    }

    if (!payload) {
      setStage('details');
      setError('Empty response from the model.');
      return;
    }

    setSummary(payload.icp.summary);
    setPoints(payload.icp.points);
    setBuyerTitles(payload.icp.buyerTitles);
    setSectors(payload.icp.sectors);
    setMeta({ source: payload.source, charsRead: payload.charsRead, model: payload.model });
    setStage('review');
  }

  async function save() {
    setSaving(true);
    setError(null);

    const response = await fetch('/bff/brand/profile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        companyName,
        productUrl,
        icp: { summary, points: points.filter(Boolean), buyerTitles, sectors }
      })
    });

    if (response.ok) {
      router.push('/brand/catalog');
      router.refresh();
      return;
    }

    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    setError(payload?.message ?? 'Could not save that profile.');
    setSaving(false);
  }

  function toggleSector(sector: Sector) {
    setSectors((current) =>
      current.includes(sector)
        ? current.filter((s) => s !== sector)
        : current.length >= MAX_SECTORS
          ? current
          : [...current, sector]
    );
  }

  if (stage === 'review') {
    return (
      <div className="onb">
        <div className="onb-main">
          <span className="t-lbl">Step 2 of 2</span>
          <h1>Everything here is a draft</h1>
          <p className="lede">
            A model reading marketing copy gets the shape right and the specifics wrong. The line you
            fix is usually the one that changes your matches most.
          </p>

          {error ? <div className="alert">{error}</div> : null}

          <section className="onb-block">
            <h2>What {companyName || 'you'} do</h2>
            <textarea
              className="area"
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </section>

          <section className="onb-block">
            <h2>Ideal customer profile</h2>
            {points.map((point, index) => (
              <div className="icp-row" key={index}>
                <span className="icp-n">{String(index + 1).padStart(2, '0')}</span>
                <textarea
                  className="area"
                  rows={2}
                  value={point}
                  onChange={(e) =>
                    setPoints((current) => current.map((p, i) => (i === index ? e.target.value : p)))
                  }
                />
                <button
                  className="btn ghost sm"
                  type="button"
                  onClick={() => setPoints((current) => current.filter((_, i) => i !== index))}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              className="btn ghost sm"
              type="button"
              onClick={() => setPoints((current) => [...current, ''])}
            >
              <Icon name="plus" size="sm" />
              Add a point
            </button>
          </section>

          <section className="onb-block">
            <h2>Sectors</h2>
            <p className="hint">
              Creators pick from this same list. It is what the match algorithm runs on, so a wrong
              tag here costs you the whole catalog. {sectors.length} of {MAX_SECTORS} chosen.
            </p>
            <div className="chips">
              {SECTORS.map((sector) => (
                <button
                  key={sector}
                  type="button"
                  className="chip"
                  data-on={sectors.includes(sector) ? '1' : undefined}
                  onClick={() => toggleSector(sector)}
                >
                  {sector}
                </button>
              ))}
            </div>
          </section>

          <div className="onb-actions">
            <button
              className="btn"
              onClick={save}
              disabled={saving || sectors.length === 0 || points.length < 3 || summary.length < 20}
            >
              {saving ? 'Saving…' : 'Confirm and open the catalog'}
            </button>
            <button className="btn ghost" type="button" onClick={() => setStage('details')}>
              Back
            </button>
          </div>
        </div>

        <aside className="onb-aside">
          <div className="card">
            <div className="card-head">
              <h3>What happened</h3>
            </div>
            <div className="card-body">
              <div className="peek-row">
                <span className="k">Source</span>
                <span className="v">{meta?.source ?? '—'}</span>
              </div>
              <div className="peek-row">
                <span className="k">Text read</span>
                <span className="v">{meta ? `${meta.charsRead.toLocaleString()} chars` : '—'}</span>
              </div>
              <div className="peek-row" style={{ borderBottom: 0 }}>
                <span className="k">Model</span>
                <span className="v">{meta?.model ?? '—'}</span>
              </div>
              <p className="note" style={{ marginTop: 'var(--s3)' }}>
                Nothing is saved until you confirm. The sectors you pick decide which creators the
                catalog ranks for you.
              </p>
            </div>
          </div>
        </aside>
      </div>
    );
  }

  return (
    <div className="onb">
      <form className="onb-main" onSubmit={generate}>
        <span className="t-lbl">Step 1 of 2</span>
        <h1>Point us at your product page</h1>
        <p className="lede">
          We read it and draft an ICP you can edit. No form to fill in describing yourself.
        </p>

        {error ? <div className="alert">{error}</div> : null}

        <section className="onb-block">
          <label className="field">
            <span>Company name</span>
            <input
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Loopwork"
            />
          </label>

          <label className="field">
            <span>Product page</span>
            <input
              required
              type="url"
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
              placeholder="https://loopwork.com"
            />
          </label>

          {needsPaste ? (
            <label className="field">
              <span>Paste your positioning</span>
              <textarea
                className="area"
                rows={6}
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                placeholder="What you sell, who buys it, and what makes them buy."
              />
            </label>
          ) : null}
        </section>

        {stage === 'reading' ? (
          <div className="reading">
            <span className="reading-bar">
              <i />
            </span>
            <span className="t-sm muted">Reading the page and drafting your ICP</span>
          </div>
        ) : (
          <div className="onb-actions">
            <button className="btn" type="submit">
              Read the page
            </button>
          </div>
        )}
      </form>

      <aside className="onb-aside">
        <div className="card">
          <div className="card-head">
            <h3>Why a URL</h3>
          </div>
          <div className="card-body">
            <p className="t-sm muted" style={{ lineHeight: 1.55 }}>
              Brands describe their own buyer badly, and a wrong ICP quietly ruins every match that
              follows. Reading your own words is more accurate than a form.
            </p>
            <div className="card-sep" style={{ margin: 'var(--s4) 0' }} />
            <p className="t-sm muted" style={{ lineHeight: 1.55 }}>
              Pages that render entirely in JavaScript come back nearly empty. When that happens we
              ask you to paste instead of quietly generating something wrong.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
