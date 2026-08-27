import { BrandWallet } from '@lm/contracts';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Icon } from '@/components/icon';
import { LiveCollabs } from '@/components/live-collabs';
import { Topbar } from '@/components/shell';
import { TopUp } from '@/components/wallet-actions';
import { ApiFailure, request } from '@/lib/api';
import { money } from '@/lib/format';

export const dynamic = 'force-dynamic';

const KIND_LABEL: Record<string, string> = {
  topup: 'Added funds',
  hold: 'Held for an assignment',
  release: 'Paid to a creator',
  refund: 'Returned to you',
  withdraw: 'Withdrawn'
};

export default async function BillingPage() {
  const cookie = (await cookies()).toString();

  let wallet: BrandWallet;
  try {
    wallet = await request('/brand/wallet', BrandWallet, { cookie });
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 401) redirect('/brand/login');
    if (error instanceof ApiFailure && error.status === 403) redirect('/creator/payouts');
    if (error instanceof ApiFailure && error.status === 404) redirect('/brand/onboarding');
    throw error;
  }

  return (
    <>
      <LiveCollabs side="brand" />
      <Topbar placeholder="Search transactions" right={<span className="av">MK</span>} />

      <div className="page">
        <div className="main-in" style={{ maxWidth: 1000 }}>
          <div className="pagehead">
            <div>
              <h1>Billing</h1>
              <p>
                A creator accepts against money that is already here. When they accept, the fee
                leaves your balance and sits in escrow until the post is verified.
              </p>
            </div>
          </div>

          <div className="stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <Stat
              icon="wallet"
              label="Available"
              value={money(wallet.balanceMinor)}
              foot="ready to commit"
            />
            <Stat
              icon="inbox"
              label="In escrow"
              value={money(wallet.heldMinor)}
              foot="committed to open assignments"
            />
            <Stat
              icon="chart"
              label="Total"
              value={money(wallet.balanceMinor + wallet.heldMinor)}
              foot="available plus committed"
            />
          </div>

          <section className="card" style={{ marginBottom: 'var(--s3)' }}>
            <div className="card-head">
              <h3>Add funds</h3>
            </div>
            <div className="card-sep" />
            <div className="card-body">
              <TopUp />
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <h3>Ledger</h3>
              <div className="acts">
                <span className="t-xs muted">{wallet.entries.length} movements</span>
              </div>
            </div>
            <div className="card-sep" />
            <div className="card-body" style={{ paddingTop: 0 }}>
              {wallet.entries.length === 0 ? (
                <div className="empty" style={{ border: 0 }}>
                  <h3>Nothing has moved yet</h3>
                  <p>Add funds, then invite a creator. Every movement lands here with its pair.</p>
                </div>
              ) : (
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>What</th>
                      <th>Assignment</th>
                      <th>When</th>
                      <th className="r">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wallet.entries.map((entry) => (
                      <tr key={entry.id}>
                        <td>{KIND_LABEL[entry.kind] ?? entry.kind}</td>
                        <td className="muted">{entry.reference ?? '—'}</td>
                        <td className="muted">
                          {new Date(entry.createdAt).toLocaleDateString('en-IE')}
                        </td>
                        <td className="r" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {entry.amountMinor < 0 ? '−' : '+'}
                          {money(Math.abs(entry.amountMinor))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function Stat({
  icon,
  label,
  value,
  foot
}: {
  icon: 'wallet' | 'inbox' | 'chart';
  label: string;
  value: string;
  foot: string;
}) {
  return (
    <div className="stat">
      <div className="top">
        <Icon name={icon} size="sm" />
        <span>{label}</span>
      </div>
      <div className="row">
        <span className="val">{value}</span>
      </div>
      <div className="foot">{foot}</div>
    </div>
  );
}
