import { CreatorWallet } from '@lm/contracts';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Icon } from '@/components/icon';
import { LiveCollabs } from '@/components/live-collabs';
import { Topbar } from '@/components/shell';
import { Withdraw } from '@/components/wallet-actions';
import { ApiFailure, request } from '@/lib/api';
import { money } from '@/lib/format';

export const dynamic = 'force-dynamic';

const KIND_LABEL: Record<string, string> = {
  release: 'Paid for an assignment',
  withdraw: 'Withdrawn',
  topup: 'Added funds',
  hold: 'Held',
  refund: 'Returned'
};

export default async function PayoutsPage() {
  const cookie = (await cookies()).toString();

  let wallet: CreatorWallet;
  try {
    wallet = await request('/creator/wallet', CreatorWallet, { cookie });
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 401) redirect('/creator/login');
    if (error instanceof ApiFailure && error.status === 403) redirect('/brand/billing');
    if (error instanceof ApiFailure && error.status === 404) redirect('/creator/onboarding');
    throw error;
  }

  const earned = wallet.entries
    .filter((entry) => entry.kind === 'release')
    .reduce((sum, entry) => sum + entry.amountMinor, 0);

  return (
    <>
      <LiveCollabs side="creator" />
      <Topbar placeholder="Search payouts" right={<span className="av">C</span>} />

      <div className="page">
        <div className="main-in" style={{ maxWidth: 900 }}>
          <div className="pagehead">
            <div>
              <h1>Payouts</h1>
              <p>
                A brand commits the fee before you accept, so the money for every assignment in
                flight is already sitting in escrow with your name on it.
              </p>
            </div>
          </div>

          <div className="stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <Stat
              icon="wallet"
              label="Ready to withdraw"
              value={money(wallet.balanceMinor)}
              foot="settled and yours"
            />
            <Stat
              icon="inbox"
              label="In escrow"
              value={money(wallet.pendingMinor)}
              foot="committed, not yet verified"
            />
            <Stat
              icon="check"
              label="Earned to date"
              value={money(earned)}
              foot="across every settled post"
            />
          </div>

          <section className="card" style={{ marginBottom: 'var(--s3)' }}>
            <div className="card-head">
              <h3>Withdraw</h3>
            </div>
            <div className="card-sep" />
            <div className="card-body">
              <Withdraw balanceMinor={wallet.balanceMinor} />
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <h3>Statement</h3>
              <div className="acts">
                <span className="t-xs muted">{wallet.entries.length} movements</span>
              </div>
            </div>
            <div className="card-sep" />
            <div className="card-body" style={{ paddingTop: 0 }}>
              {wallet.entries.length === 0 ? (
                <div className="empty" style={{ border: 0 }}>
                  <h3>Nothing has settled yet</h3>
                  <p>
                    A post pays out two days after the brand verifies it, and after seven days it
                    verifies itself.
                  </p>
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
  icon: 'wallet' | 'inbox' | 'check';
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
