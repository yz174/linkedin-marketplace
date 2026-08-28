import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { CampaignForm } from '@/components/campaign-form';
import { LiveCollabs } from '@/components/live-collabs';
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

      <div className="page">
        <div className="main-in">
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
            <div className="camp-list">
              {campaigns.items.map((campaign) => {
                const booked = collabs.items.filter((c) => c.campaignTitle === campaign.title);
                const committed = booked.reduce(
                  (sum, c) => sum + (c.counterFeeMinor ?? c.feeMinor),
                  0
                );

                return (
                  <article className="camp-card" key={campaign.id}>
                    <div className="camp-card-head">
                      <div>
                        <h3>{campaign.title}</h3>
                        <span className="camp-card-meta">
                          <span className="camp-src">{campaign.source}</span> ·{' '}
                          {new Date(campaign.createdAt).toLocaleDateString('en-IE', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                      <span className="camp-booked">
                        <b>{booked.length}</b>
                        <span>{booked.length === 1 ? 'creator booked' : 'creators booked'}</span>
                      </span>
                    </div>

                    <p className="camp-objective">{campaign.objective}</p>

                    <div className="camp-facts">
                      <span>
                        <span className="k">Budget band</span>
                        <span className="v">
                          {money(campaign.budgetMinMinor)} – {money(campaign.budgetMaxMinor)}
                        </span>
                      </span>
                      <span>
                        <span className="k">Committed</span>
                        <span className="v">{money(committed)}</span>
                      </span>
                      <span>
                        <span className="k">Deliverable</span>
                        <span className="v" style={{ fontWeight: 500, fontSize: 13 }}>
                          {campaign.deliverable}
                        </span>
                      </span>
                    </div>

                    {campaign.keyMessages.length > 0 || campaign.doNot.length > 0 ? (
                      <div className="camp-guides">
                        {campaign.keyMessages.length > 0 ? (
                          <div className="camp-guide">
                            <h4>Key messages</h4>
                            <ol>
                              {campaign.keyMessages.map((line) => (
                                <li key={line}>{line}</li>
                              ))}
                            </ol>
                          </div>
                        ) : null}
                        {campaign.doNot.length > 0 ? (
                          <div className="camp-guide dont">
                            <h4>Won&rsquo;t do</h4>
                            <ul>
                              {campaign.doNot.map((line) => (
                                <li key={line}>{line}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
