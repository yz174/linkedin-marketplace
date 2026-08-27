'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Side = 'brand' | 'creator';

const PRESETS = [50_000, 100_000, 250_000];

export function TopUp() {
  return <WalletAction side="brand" />;
}

export function Withdraw({ balanceMinor }: { balanceMinor: number }) {
  return <WalletAction side="creator" balanceMinor={balanceMinor} />;
}

function WalletAction({ side, balanceMinor }: { side: Side; balanceMinor?: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(amountMinor: number) {
    if (amountMinor <= 0) return;
    setBusy(true);
    setError(null);

    const path =
      side === 'brand' ? '/bff/brand/wallet/topup' : '/bff/creator/wallet/withdraw';

    const response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
      credentials: 'include',
      body: JSON.stringify({ amountMinor })
    });

    if (response.ok) {
      router.refresh();
      setBusy(false);
      return;
    }

    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    setError(payload?.message ?? 'That did not go through.');
    setBusy(false);
  }

  if (side === 'creator') {
    const available = balanceMinor ?? 0;
    return (
      <div>
        {error ? <div className="alert">{error}</div> : null}
        <button className="btn" disabled={busy || available === 0} onClick={() => submit(available)}>
          {busy ? 'Sending…' : 'Withdraw everything'}
        </button>
        <p className="t-xs muted" style={{ marginTop: 'var(--s2)' }}>
          Settles by SEPA within a day. No payment provider is wired up yet, so this moves the
          balance in our ledger and nothing else.
        </p>
      </div>
    );
  }

  return (
    <div>
      {error ? <div className="alert">{error}</div> : null}
      <div style={{ display: 'flex', gap: 'var(--s2)', flexWrap: 'wrap' }}>
        {PRESETS.map((amount) => (
          <button
            key={amount}
            className="btn ghost sm"
            disabled={busy}
            onClick={() => submit(amount)}
          >
            Add €{(amount / 100).toLocaleString('en-IE')}
          </button>
        ))}
      </div>
      <p className="t-xs muted" style={{ marginTop: 'var(--s2)' }}>
        No card is charged. This credits the wallet directly so escrow can be exercised end to
        end.
      </p>
    </div>
  );
}
