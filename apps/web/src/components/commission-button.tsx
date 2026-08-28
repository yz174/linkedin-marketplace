'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icon';
import { money } from '@/lib/format';

type Campaign = { id: string; title: string };

function CampaignSelect({
  value,
  options,
  onChange
}: {
  value: string;
  options: Campaign[];
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const current = options.find((o) => o.id === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="dropdown" ref={ref}>
      <button
        type="button"
        className="dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{current?.title ?? 'Pick a campaign'}</span>
        <Icon name="down" size="sm" />
      </button>
      {open ? (
        <div className="dropdown-menu" role="listbox">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              role="option"
              aria-selected={o.id === value}
              className="dropdown-item"
              onClick={() => {
                onChange(o.id);
                setOpen(false);
              }}
            >
              {o.title}
              {o.id === value ? <Icon name="check" size="sm" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CommissionButton({
  creatorId,
  creatorName,
  ratePerPostMinor,
  campaigns
}: {
  creatorId: string;
  creatorName: string;
  ratePerPostMinor: number;
  campaigns: Campaign[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? '');
  const [fee, setFee] = useState(String(Math.round(ratePerPostMinor / 100)));

  async function invite() {
    setBusy(true);
    setError(null);

    const response = await fetch('/bff/brand/collaborations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        campaignId,
        creatorId,
        feeMinor: Math.round(Number(fee) * 100)
      })
    });

    if (response.ok) {
      setOpen(false);
      router.push('/brand/collaborations');
      router.refresh();
      return;
    }

    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    setError(payload?.message ?? 'Could not send that invitation.');
    setBusy(false);
  }

  if (campaigns.length === 0) {
    return (
      <a className="btn ghost sm" href="/brand/campaigns">
        Create a campaign first
      </a>
    );
  }

  if (!open) {
    return (
      <button className="btn sm" onClick={() => setOpen(true)}>
        Commission
      </button>
    );
  }

  return (
    <div className="commission">
      {error ? (
        <span className="t-xs" style={{ color: 'var(--down-fg)' }}>
          {error}
        </span>
      ) : null}
      <label className="field" style={{ margin: 0 }}>
        <span>Campaign</span>
        <CampaignSelect value={campaignId} options={campaigns} onChange={setCampaignId} />
      </label>
      <label className="field" style={{ margin: 0 }}>
        <span>Fee, euros</span>
        <input value={fee} onChange={(e) => setFee(e.target.value)} inputMode="numeric" />
      </label>
      <div className="collab-acts">
        <button className="btn sm" disabled={busy || !campaignId} onClick={invite}>
          {busy ? 'Sending…' : `Invite ${creatorName.split(' ')[0]}`}
        </button>
        <button className="btn ghost sm" disabled={busy} onClick={() => setOpen(false)}>
          Back
        </button>
      </div>
      <span className="t-xs muted">Their rate is {money(ratePerPostMinor)}.</span>
    </div>
  );
}
