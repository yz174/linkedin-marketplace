'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { money } from '@/lib/format';

type Campaign = { id: string; title: string };

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
      {error ? <span className="t-xs" style={{ color: 'var(--down-fg)' }}>{error}</span> : null}
      <label className="field" style={{ margin: 0 }}>
        <span>Campaign</span>
        <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
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
