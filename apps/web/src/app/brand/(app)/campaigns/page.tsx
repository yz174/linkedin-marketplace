import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { CampaignForm } from '@/components/campaign-form';
import { Icon } from '@/components/icon';
import { LiveCollabs } from '@/components/live-collabs';
import { Topbar } from '@/components/shell';
import { ApiFailure, request } from '@/lib/api';
import { CollabList } from '@/lib/collab';
import { money } from '@/lib/format';

export const dynamic = 'force-dynamic';

const CampaignList = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      title: z.string(),
      objective: z.string(),
      keyMessages: z.array(z.string()),
      doNot: z.array(z.string()),
      deliverable: z.string(),
      budgetMinMinor: z.number(),
      budgetMaxMinor: z.number(),
      source: z.string(),
      createdAt: z.string()
    })
  )
});

export default async function CampaignsPage() {
  const cookie = (await cookies()).toString();

  let campaigns;
  try {
    campaigns = await request('/brand/campaigns', CampaignList, { cookie });
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 401) redirect('/brand/login');
    if (error instanceof ApiFailure && error.status === 403) redirect('/creator/offers');
    if (error instanceof ApiFailure && error.status === 404) redirect('/brand/onboarding');
    throw error;
  }

  const collabs = await request('/brand/collaborations', CollabList, { cookie }).catch(() => ({
    items: []
  }));

  return (
    <>
      <LiveCollabs side="brand" />
      <Topbar
        placeholder="Search campaigns"
        right={
          <>
            <Link className="btn ghost sm" href="/brand/collaborations">
              <Icon name="inbox" size="sm" />
              Assignments
            </Link>
            <span className="av">MK</span>
          </>
        }
      />

      <div className="page">
        <div className="main-in" style={{ maxWidth: 860 }}>
          <div className="pagehead">
            <div>
              <h1>Campaigns</h1>
              <p>
                A campaign is what a creator actually reads before deciding. Say the objective and
                the constraints, then let them write it in their own voice.
              </p>
            </div>
            <div className="acts">
              <CampaignForm />
            </div>
          </div>

          {campaigns.items.length === 0 ? (
            <div className="empty">
              <h3>No campaigns yet</h3>
              <p>
                You need one before you can commission anyone. It takes a minute and you can edit it
                after.
              </p>
            </div>
          ) : (
            campaigns.items.map((campaign) => {
              const booked = collabs.items.filter((c) => c.campaignTitle === campaign.title);
              const committed = booked.reduce((sum, c) => sum + (c.counterFeeMinor ?? c.feeMinor), 0);

              return (
                <article className="card" key={campaign.id} style={{ marginBottom: 'var(--s3)' }}>
                  <div className="card-head">
                    <h3>{campaign.title}</h3>
                    <div className="acts">
                      <span className="tag grey">{campaign.source}</span>
                      <span className="t-xs muted">
                        {new Date(campaign.createdAt).toLocaleDateString('en-IE')}
                      </span>
                    </div>
                  </div>
                  <div className="card-sep" />
                  <div className="card-body" style={{ paddingTop: 'var(--s4)' }}>
                    <p className="t-sm" style={{ lineHeight: 1.55 }}>
                      {campaign.objective}
                    </p>

                    <div className="collab-meta" style={{ marginTop: 'var(--s4)' }}>
                      <span>
                        <span className="k">Budget band</span>
                        <span className="v">
                          {money(campaign.budgetMinMinor)} to {money(campaign.budgetMaxMinor)}
                        </span>
                      </span>
                      <span>
                        <span className="k">Contributors</span>
                        <span className="v">{booked.length}</span>
                      </span>
                      <span>
                        <span className="k">Committed</span>
                        <span className="v">{money(committed)}</span>
                      </span>
                    </div>

                    {campaign.doNot.length > 0 ? (
                      <>
                        <div className="card-sep" style={{ margin: 'var(--s4) 0' }} />
                        <span className="t-lbl">Do not</span>
                        <ul style={{ marginTop: 'var(--s2)' }}>
                          {campaign.doNot.map((line) => (
                            <li key={line} className="t-sm muted" style={{ padding: '3px 0' }}>
                              {line}
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
