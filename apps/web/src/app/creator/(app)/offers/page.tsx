import { MAX_COUNTER_ROUNDS, TERMINAL_STATES, type CollabState } from '@lm/contracts';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Icon } from '@/components/icon';
import { CollabActions } from '@/components/collab-actions';
import { Topbar } from '@/components/shell';
import { ApiFailure, request } from '@/lib/api';
import { CollabList } from '@/lib/collab';
import { money } from '@/lib/format';

export const dynamic = 'force-dynamic';

const LABEL: Record<string, string> = {
  invited: 'Waiting on you',
  countered: 'Your counter is with them',
  accepted: 'Accepted',
  brief_shared: 'Brief received',
  draft_submitted: 'Draft with the brand',
  revision_requested: 'Changes requested',
  draft_approved: 'Approved, link minted',
  scheduled: 'Scheduled',
  published: 'Published',
  verified: 'Verified',
  paid: 'Paid',
  declined: 'Declined',
  expired: 'Expired',
  cancelled: 'Cancelled'
};

const TONE: Record<string, string> = {
  invited: 'warn',
  countered: 'info',
  draft_approved: 'info',
  published: 'ok',
  verified: 'ok',
  paid: 'ok'
};

export default async function OffersPage() {
  const cookie = (await cookies()).toString();

  let data;
  try {
    data = await request('/creator/collaborations', CollabList, { cookie });
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 401) redirect('/creator/login');
    if (error instanceof ApiFailure && error.status === 403) redirect('/brand/catalog');
    if (error instanceof ApiFailure && error.status === 404) redirect('/creator/onboarding');
    throw error;
  }

  const open = data.items.filter((i) => !TERMINAL_STATES.includes(i.state as CollabState));
  const settled = data.items.filter((i) => TERMINAL_STATES.includes(i.state as CollabState));
  const onTheTable = open
    .filter((i) => i.state === 'invited' || i.state === 'countered')
    .reduce((sum, i) => sum + (i.counterFeeMinor ?? i.feeMinor), 0);

  return (
    <>
      <Topbar
        placeholder="Search offers, brands, payouts"
        right={
          <>
            <Link className="btn ghost sm" href="/creator/card">
              <Icon name="card" size="sm" />
              Your card
            </Link>
            <span className="av">C</span>
          </>
        }
      />

      <div className="page">
        <div className="main-in" style={{ maxWidth: 900 }}>
          <div className="pagehead">
            <div>
              <h1>Offers</h1>
              <p>
                Declining costs you nothing. Your delivery record counts posts you accepted and did
                not publish, so decline freely and accept only what you would have written anyway.
              </p>
            </div>
          </div>

          <div className="stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="stat">
              <div className="top">
                <Icon name="inbox" size="sm" />
                <span>Open</span>
              </div>
              <div className="row">
                <span className="val">{open.length}</span>
              </div>
              <div className="foot">assignments in flight</div>
            </div>
            <div className="stat">
              <div className="top">
                <Icon name="wallet" size="sm" />
                <span>On the table</span>
              </div>
              <div className="row">
                <span className="val">{money(onTheTable)}</span>
              </div>
              <div className="foot">still to accept or decline</div>
            </div>
            <div className="stat">
              <div className="top">
                <Icon name="check" size="sm" />
                <span>Settled</span>
              </div>
              <div className="row">
                <span className="val">{settled.length}</span>
              </div>
              <div className="foot">closed either way</div>
            </div>
          </div>

          {open.length === 0 ? (
            <div className="empty">
              <h3>No open offers</h3>
              <p>
                Brands find you through the catalog. Your topics and delivery record decide how often
                you appear, so keep both accurate.
              </p>
              <Link className="btn" href="/creator/card">
                Check your card
              </Link>
            </div>
          ) : (
            open.map((row) => {
              const negotiating = row.state === 'invited' || row.state === 'countered';
              return (
                <article className="offer" key={row.id} data-live={negotiating ? '1' : undefined}>
                  <div className="offer-top">
                    <span className="av lg">B</span>
                    <div>
                      <div className="offer-brand">{row.campaignTitle}</div>
                      <div className="offer-ref">
                        {row.reference} · invited {new Date(row.invitedAt).toLocaleDateString('en-IE')}
                      </div>
                    </div>
                    <div className="offer-fee">
                      {row.counterFeeMinor === null ? (
                        money(row.feeMinor)
                      ) : (
                        <>
                          <s>{money(row.feeMinor)}</s>
                          {money(row.counterFeeMinor)}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="offer-meta">
                    <span>
                      <span className="k">Status</span>
                      <span className={`pill ${TONE[row.state] ?? ''}`}>
                        <span className="d" />
                        {LABEL[row.state] ?? row.state}
                      </span>
                    </span>
                    <span>
                      <span className="k">Rounds used</span>
                      <span className="v">
                        {row.counterRounds} of {MAX_COUNTER_ROUNDS}
                      </span>
                    </span>
                    <span>
                      <span className="k">Publish by</span>
                      <span className="v">
                        {row.publishBy ? new Date(row.publishBy).toLocaleDateString('en-IE') : '—'}
                      </span>
                    </span>
                    <span>
                      <span className="k">Tracked link</span>
                      <span className="v">{row.trackedLink ?? 'On approval'}</span>
                    </span>
                  </div>

                  <div className="offer-acts">
                    <CollabActions
                      id={row.id}
                      side="creator"
                      allowed={row.allowed}
                      feeMinor={row.counterFeeMinor ?? row.feeMinor}
                    />
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
