import { CreatorCard } from '@lm/contracts';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Icon } from '@/components/icon';
import { Topbar } from '@/components/shell';
import { ApiFailure, request } from '@/lib/api';
import { count, initials, money, percent } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function CreatorCardPage() {
  const cookie = (await cookies()).toString();

  let card: CreatorCard;
  try {
    card = await request('/creator/profile', CreatorCard, { cookie });
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 401) redirect('/creator/login');
    if (error instanceof ApiFailure && error.status === 403) redirect('/brand/catalog');
    if (error instanceof ApiFailure && error.status === 404) redirect('/creator/onboarding');
    throw error;
  }

  return (
    <>
      <Topbar
        placeholder="Search offers, brands, payouts"
        right={
          <>
            <button className="btn ghost sm">
              <Icon name="export" size="sm" />
              Statements
            </button>
            <button className="iconbtn">
              <Icon name="bell" size="lg" />
            </button>
            <span className="av">{initials(card.name)}</span>
          </>
        }
      />

      <div className="page">
        <div className="main-in railed">
          <div>
            <div className="pagehead">
              <div>
                <h1>Your card</h1>
                <p>
                  This is exactly what a brand sees before they book you. Every number came from
                  your own posts, not from a form.
                </p>
              </div>
              <div className="acts">
                <Link className="btn ghost" href="/creator/onboarding">
                  Edit
                </Link>
              </div>
            </div>

            <div className="bluecard" style={{ marginBottom: 'var(--s5)' }}>
              <span className="lbl">Contributor {card.contributorNumber}</span>
              <div className="nm">{card.name}</div>
              <div className="facts">
                <span className="fact">
                  <span className="k">Followers</span>
                  <span className="v">{count(card.followers)}</span>
                </span>
                <span className="fact">
                  <span className="k">Engagement</span>
                  <span className="v">{percent(card.engagementRate)}</span>
                </span>
                <span className="fact">
                  <span className="k">Posts / week</span>
                  <span className="v">{card.postsPerWeek}</span>
                </span>
                <span className="fact">
                  <span className="k">Per post</span>
                  <span className="v">{money(card.ratePerPostMinor)}</span>
                </span>
              </div>
              <div className="tags">
                {card.topics.map((topic) => (
                  <span key={topic}>{topic}</span>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <h3>Delivery record</h3>
                <div className="acts">
                  <span className="t-xs muted">Public on your card</span>
                </div>
              </div>
              <div className="card-sep" />
              <div className="card-body" style={{ paddingTop: 'var(--s3)' }}>
                <table className="tbl">
                  <tbody>
                    <tr>
                      <td>Offers accepted</td>
                      <td className="r num">{card.acceptedCount}</td>
                    </tr>
                    <tr>
                      <td>Posts published</td>
                      <td className="r num">{card.deliveredCount}</td>
                    </tr>
                    <tr>
                      <td>Delivery rate</td>
                      <td className="r num" style={{ color: 'var(--blue)', fontWeight: 600 }}>
                        {card.deliveryRate === null ? 'No record yet' : percent(card.deliveryRate, 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p className="note" style={{ marginTop: 'var(--s4)' }}>
                  {card.deliveryRate === null
                    ? 'New creators sit at a neutral prior, so a thin record never buries you. It fills in from your first accepted offer.'
                    : 'This is the reason a brand picks you over someone cheaper, and the reason we can pay you inside 24 hours instead of on an invoice cycle.'}
                </p>
              </div>
            </div>
          </div>

          <aside className="rail-stack">
            <div className="card">
              <div className="card-head">
                <h3>Headline</h3>
              </div>
              <div className="card-body">
                <p className="t-sm" style={{ lineHeight: 1.55 }}>
                  {card.headline || 'No headline yet.'}
                </p>
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <h3>Where your rate sits</h3>
              </div>
              <div className="card-body">
                <div className="peek-row">
                  <span className="k">You charge</span>
                  <span className="v">{money(card.ratePerPostMinor)}</span>
                </div>
                <div className="peek-row">
                  <span className="k">Band median</span>
                  <span className="v">{bandMedian(card.followers)}</span>
                </div>
                <div className="peek-row" style={{ borderBottom: 0 }}>
                  <span className="k">Your engagement</span>
                  <span className="v">{percent(card.engagementRate)}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

function bandMedian(followers: number) {
  if (followers < 5_000) return '€84';
  if (followers < 25_000) return '€300';
  if (followers < 50_000) return '€588';
  return '€720';
}
