import { BrandAnalytics } from '@lm/contracts';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Icon } from '@/components/icon';
import { LiveCollabs } from '@/components/live-collabs';
import { Topbar } from '@/components/shell';
import { ApiFailure, request } from '@/lib/api';
import { count, money } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const cookie = (await cookies()).toString();

  let data: BrandAnalytics;
  try {
    data = await request('/brand/analytics', BrandAnalytics, { cookie });
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 401) redirect('/brand/login');
    if (error instanceof ApiFailure && error.status === 403) redirect('/creator/payouts');
    if (error instanceof ApiFailure && error.status === 404) redirect('/brand/onboarding');
    throw error;
  }

  const measured = data.campaigns.filter((campaign) => campaign.published > 0);

  return (
    <>
      <LiveCollabs side="brand" />
      <Topbar placeholder="Search campaigns" right={<span className="av">MK</span>} />

      <div className="page">
        <div className="main-in" style={{ maxWidth: 1000 }}>
          <div className="pagehead">
            <div>
              <h1>Analytics</h1>
              <p>
                Every published post carries a tracked link, so these numbers cover all of them
                rather than the fraction that remembered to use one.
              </p>
            </div>
          </div>

          <div className="stats" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <Stat
              icon="chart"
              label="Clicks"
              value={count(data.totals.clicks)}
              foot={`${count(data.totals.visitors)} unique visitors`}
            />
            <Stat
              icon="wallet"
              label="Spend"
              value={money(data.totals.spendMinor)}
              foot="released to creators"
            />
            <Stat
              icon="inbox"
              label="Committed"
              value={money(data.totals.committedMinor)}
              foot="in escrow right now"
            />
            <Stat
              icon="file"
              label="Cost per click"
              value={
                data.totals.costPerClickMinor === null
                  ? '—'
                  : money(data.totals.costPerClickMinor)
              }
              foot={measured.length === 0 ? 'nothing published yet' : 'spend divided by clicks'}
            />
          </div>

          <section className="card">
            <div className="card-head">
              <h3>By campaign</h3>
              <div className="acts">
                <Link className="btn ghost sm" href="/brand/campaigns">
                  <Icon name="file" size="sm" />
                  Campaigns
                </Link>
              </div>
            </div>
            <div className="card-sep" />
            <div className="card-body" style={{ paddingTop: 0 }}>
              {data.campaigns.length === 0 ? (
                <div className="empty" style={{ border: 0 }}>
                  <h3>No campaigns yet</h3>
                  <p>Create one, invite a creator, and the tracked link starts counting.</p>
                  <Link className="btn" href="/brand/campaigns">
                    Create a campaign
                  </Link>
                </div>
              ) : (
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
                    {data.campaigns.map((campaign) => (
                      <tr key={campaign.campaignId}>
                        <td>
                          <span className="nm">{campaign.title}</span>
                          <span className="sub" style={{ display: 'block' }}>
                            {campaign.assignments} assigned
                          </span>
                        </td>
                        <td className="r">{campaign.published}</td>
                        <td className="r">{count(campaign.clicks)}</td>
                        <td className="r">{count(campaign.visitors)}</td>
                        <td className="r">{money(campaign.spendMinor)}</td>
                        <td className="r">
                          {campaign.costPerClickMinor === null
                            ? '—'
                            : money(campaign.costPerClickMinor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <p className="t-xs muted" style={{ marginTop: 'var(--s3)' }}>
            Impressions and attributed signups are missing on purpose. LinkedIn does not expose
            impressions to us, and a signup happens on your site where we run no code.
          </p>
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
  icon: 'chart' | 'wallet' | 'inbox' | 'file';
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
