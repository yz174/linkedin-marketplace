import { BrandAnalytics } from '@lm/contracts';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BarChart } from '@/components/charts/bar-chart';
import { Gauge } from '@/components/charts/gauge';
import { Icon, type IconName } from '@/components/icon';
import { LiveCollabs } from '@/components/live-collabs';
import { ApiFailure, request } from '@/lib/api';
import { CollabList, NEEDS_YOU, STATE_LABEL, STATE_TONE } from '@/lib/collab';
import { count, initials, money, percent } from '@/lib/format';

export const dynamic = 'force-dynamic';

const CLOSED = ['paid', 'declined', 'expired', 'cancelled'];

export default async function DashboardPage() {
  const cookie = (await cookies()).toString();

  let analytics: BrandAnalytics;
  try {
    analytics = await request('/brand/analytics', BrandAnalytics, { cookie });
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 401) redirect('/?role=brand');
    if (error instanceof ApiFailure && error.status === 403) redirect('/creator/dashboard');
    if (error instanceof ApiFailure && error.status === 404) redirect('/?role=brand');
    throw error;
  }

  const collabs = await request('/brand/collaborations', CollabList, { cookie }).catch(() => ({
    items: []
  }));

  const open = collabs.items.filter((row) => !CLOSED.includes(row.state));
  const waiting = open.filter((row) => NEEDS_YOU.brand!.includes(row.state));

  const assignments = analytics.campaigns.reduce((n, c) => n + c.assignments, 0);
  const published = analytics.campaigns.reduce((n, c) => n + c.published, 0);
  const hasCampaigns = analytics.campaigns.length > 0;

  return (
    <>
      <LiveCollabs side="brand" />

      <div className="page">
        <div className="main-in">
          <div className="pagehead">
            <div>
              <h1>Dashboard</h1>
              <p>Where your spend is, what needs a decision, and how each campaign is landing.</p>
            </div>
            <div className="acts">
              <Link className="btn ghost" href="/brand/campaigns">
                New campaign
              </Link>
              <Link className="btn" href="/brand/catalog">
                Open catalog
              </Link>
            </div>
          </div>

          <div className="stats">
            <Stat icon="chart" label="Clicks" value={count(analytics.totals.clicks)} foot={`${count(analytics.totals.visitors)} visitors`} />
            <Stat icon="wallet" label="Spend" value={money(analytics.totals.spendMinor)} foot="released to creators" />
            <Stat icon="inbox" label="In escrow" value={money(analytics.totals.committedMinor)} foot="committed right now" />
            <Stat
              icon="file"
              label="Cost per click"
              value={analytics.totals.costPerClickMinor === null ? '—' : money(analytics.totals.costPerClickMinor)}
              foot={published === 0 ? 'nothing published yet' : 'spend divided by clicks'}
            />
          </div>

          {hasCampaigns ? (
            <div className="chart-row">
              <BarChart
                title="Clicks by campaign"
                data={analytics.campaigns.map((c) => ({ label: c.title, value: c.clicks }))}
              />
              <BarChart
                title="Spend by campaign"
                data={analytics.campaigns.map((c) => ({ label: c.title, value: c.spendMinor }))}
                format="currency"
              />
              <figure className="chart">
                <figcaption className="chart-title">Published rate</figcaption>
                <div style={{ padding: 'var(--s4) 0 var(--s2)' }}>
                  <Gauge
                    orientation="arc"
                    value={assignments === 0 ? 0 : (published / assignments) * 100}
                    centerValue={assignments === 0 ? '—' : `${Math.round((published / assignments) * 100)}%`}
                    label={`${published} of ${assignments} live`}
                  />
                </div>
              </figure>
            </div>
          ) : null}

          <section className="collab-section">
            <h2 className="collab-section-head">
              Needs a decision
              <Link className="btn ghost sm" href="/brand/collaborations" style={{ marginLeft: 'auto' }}>
                All assignments
              </Link>
            </h2>
            {waiting.length === 0 ? (
              <p className="t-sm muted">
                Nothing waiting on you. New counter-offers and submitted drafts land here.
              </p>
            ) : (
              <div className="collab-list">
                {waiting.map((row) => (
                  <div className="collab-row" key={row.id}>
                    <div>
                      <div className="collab-who">
                        <span className="av">{initials(row.creatorName)}</span>
                        <span>
                          <span className="collab-name">{row.creatorName}</span>
                          <span className="collab-sub">
                            {row.reference} · {row.campaignTitle}
                          </span>
                        </span>
                        <span
                          className={`pill ${STATE_TONE[row.state] ?? ''}`}
                          style={{ marginLeft: 'auto' }}
                        >
                          <span className="d" />
                          {STATE_LABEL[row.state] ?? row.state}
                        </span>
                      </div>
                    </div>
                    <div className="collab-right">
                      <Link className="btn sm" href="/brand/collaborations">
                        Review
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="collab-section">
            <h2 className="collab-section-head">
              By campaign
              <Link className="btn ghost sm" href="/brand/campaigns" style={{ marginLeft: 'auto' }}>
                Campaigns
              </Link>
            </h2>
            {!hasCampaigns ? (
              <div className="empty" style={{ border: 0 }}>
                <h3>No campaigns yet</h3>
                <p>Create one, invite a creator, and the tracked link starts counting.</p>
                <Link className="btn" href="/brand/campaigns">
                  Create a campaign
                </Link>
              </div>
            ) : (
              <div className="card" style={{ overflowX: 'auto', padding: '2px var(--s5) var(--s3)' }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Campaign</th>
                      <th className="r">Live</th>
                      <th className="r">Clicks</th>
                      <th className="r">Visitors</th>
                      <th className="r">Spend</th>
                      <th className="r">Per click</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.campaigns.map((c) => (
                      <tr key={c.campaignId}>
                        <td>
                          <span className="nm">{c.title}</span>
                          <span className="sub" style={{ display: 'block' }}>
                            {c.assignments} assigned
                          </span>
                        </td>
                        <td className="r num">{c.published}</td>
                        <td className="r num">{count(c.clicks)}</td>
                        <td className="r num">{count(c.visitors)}</td>
                        <td className="r num">{money(c.spendMinor)}</td>
                        <td className="r num">
                          {c.costPerClickMinor === null ? '—' : money(c.costPerClickMinor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <p className="t-xs muted" style={{ marginTop: 'var(--s3)' }}>
            Every published post carries a tracked link, so clicks cover all of them. Impressions and
            signups are absent on purpose: LinkedIn does not expose impressions, and a signup happens
            on your site where we run no code.
          </p>
        </div>
      </div>
    </>
  );
}

function Stat({ icon, label, value, foot }: { icon: IconName; label: string; value: string; foot: string }) {
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
