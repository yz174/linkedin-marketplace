import { CreatorCard, CreatorWallet } from '@lm/contracts';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BarChart } from '@/components/charts/bar-chart';
import { Gauge } from '@/components/charts/gauge';
import { CreatorFaceCard } from '@/components/catalog-card';
import { Icon, type IconName } from '@/components/icon';
import { LiveCollabs } from '@/components/live-collabs';
import { ApiFailure, request } from '@/lib/api';
import { money, percent } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function CreatorDashboardPage() {
  const cookie = (await cookies()).toString();

  let card: CreatorCard;
  try {
    card = await request('/creator/profile', CreatorCard, { cookie });
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 401) redirect('/?role=creator');
    if (error instanceof ApiFailure && error.status === 403) redirect('/brand/dashboard');
    if (error instanceof ApiFailure && error.status === 404) redirect('/?role=creator');
    throw error;
  }

  const wallet = await request('/creator/wallet', CreatorWallet, { cookie }).catch(() => ({
    balanceMinor: 0,
    pendingMinor: 0,
    entries: [] as CreatorWallet['entries']
  }));

  const earnedToDate = wallet.entries
    .filter((e) => e.kind === 'release')
    .reduce((sum, e) => sum + e.amountMinor, 0);

  const byMonth = new Map<string, { key: number; total: number }>();
  for (const e of wallet.entries) {
    if (e.kind !== 'release') continue;
    const d = new Date(e.createdAt);
    const label = d.toLocaleDateString('en-IE', { month: 'short' });
    const key = d.getFullYear() * 12 + d.getMonth();
    const row = byMonth.get(label) ?? { key, total: 0 };
    row.total += e.amountMinor;
    byMonth.set(label, row);
  }
  const earningsData = [...byMonth.entries()]
    .sort((a, b) => a[1].key - b[1].key)
    .map(([label, v]) => ({ label, value: v.total }));


  const deliveryPct =
    card.acceptedCount === 0 ? 0 : (card.deliveredCount / card.acceptedCount) * 100;

  return (
    <>
      <LiveCollabs side="creator" />

      <div className="page">
        <div className="main-in">
          <div className="pagehead">
            <div>
              <h1>Dashboard</h1>
              <p>What you have earned, what is in flight, and the card a brand sees.</p>
            </div>
            <div className="acts">
              <Link className="btn ghost" href="/creator/onboarding">
                Edit card
              </Link>
              <Link className="btn" href="/creator/offers">
                Offers
              </Link>
            </div>
          </div>

          <div className="creator-top">
            <div className="catalog-grid creator-face">
              <CreatorFaceCard
                name={card.name}
                topics={card.topics}
                headline={card.headline || undefined}
                stats={[
                  { label: 'Followers', value: card.followers.toLocaleString('en-IE') },
                  { label: 'Engagement', value: percent(card.engagementRate, 2) },
                  { label: 'Posts / week', value: String(card.postsPerWeek) },
                  { label: 'Your rate', value: money(card.ratePerPostMinor) }
                ]}
              />
            </div>
            <div className="creator-top-right">
              <div className="creator-top-stats">
                <Stat icon="check" label="Earned to date" value={money(earnedToDate)} foot="across every settled post" />
                <Stat icon="wallet" label="Ready to withdraw" value={money(wallet.balanceMinor)} foot="settled and yours" />
                <Stat icon="inbox" label="In escrow" value={money(wallet.pendingMinor)} foot="committed, not yet verified" />
                <Stat
                  icon="chart"
                  label="Delivery rate"
                  value={card.deliveryRate === null ? '—' : percent(card.deliveryRate, 0)}
                  foot={`${card.deliveredCount} of ${card.acceptedCount} accepted`}
                />
              </div>

              <div className="chart-row">
                <BarChart title="Earnings by month" data={earningsData} format="currency" />
                <figure className="chart">
                  <figcaption className="chart-title">Delivery</figcaption>
                  <div style={{ padding: 'var(--s4) 0 var(--s2)' }}>
                    <Gauge
                      orientation="arc"
                      value={deliveryPct}
                      centerValue={card.acceptedCount === 0 ? '—' : `${Math.round(deliveryPct)}%`}
                      label={`${card.deliveredCount} of ${card.acceptedCount} delivered`}
                    />
                  </div>
                </figure>
              </div>
            </div>
          </div>
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
  icon: IconName;
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
