import { TERMINAL_STATES, type CollabState } from '@lm/contracts';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CollabActions } from '@/components/collab-actions';
import { Icon } from '@/components/icon';
import { Topbar } from '@/components/shell';
import { ApiFailure, request } from '@/lib/api';
import { CollabList, NEEDS_YOU, STATE_LABEL, STATE_TONE, type CollabRow } from '@/lib/collab';
import { initials, money } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function CollaborationsPage() {
  const cookie = (await cookies()).toString();

  let data;
  try {
    data = await request('/brand/collaborations', CollabList, { cookie });
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 401) redirect('/brand/login');
    if (error instanceof ApiFailure && error.status === 403) redirect('/creator/offers');
    if (error instanceof ApiFailure && error.status === 404) redirect('/brand/onboarding');
    throw error;
  }

  const open = data.items.filter((i) => !TERMINAL_STATES.includes(i.state as CollabState));
  const closed = data.items.filter((i) => TERMINAL_STATES.includes(i.state as CollabState));
  const waiting = open.filter((i) => NEEDS_YOU.brand!.includes(i.state));
  const committed = open.reduce((sum, i) => sum + i.feeMinor, 0);

  return (
    <>
      <Topbar
        placeholder="Search assignments, creators, campaigns"
        right={
          <>
            <Link className="btn ghost sm" href="/brand/catalog">
              <Icon name="users" size="sm" />
              Catalog
            </Link>
            <span className="av">MK</span>
          </>
        }
      />

      <div className="page">
        <div className="main-in" style={{ maxWidth: 1000 }}>
          <div className="pagehead">
            <div>
              <h1>Assignments</h1>
              <p>
                A post cannot reach published without its tracked link. That is a constraint in the
                state machine and in the database, not a reminder in a tooltip.
              </p>
            </div>
          </div>

          <div className="stats" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <Stat icon="inbox" label="In production" value={String(open.length)} foot="not yet closed" />
            <Stat icon="bell" label="Waiting on you" value={String(waiting.length)} foot="needs a decision" />
            <Stat icon="wallet" label="Committed" value={money(committed)} foot="across open assignments" />
            <Stat icon="check" label="Closed" value={String(closed.length)} foot="settled either way" />
          </div>

          {waiting.length > 0 ? (
            <section className="card" style={{ marginBottom: 'var(--s3)' }}>
              <div className="card-head">
                <h3>Needs a decision</h3>
                <div className="acts">
                  <span className="pill warn">
                    <span className="d" />
                    {waiting.length}
                  </span>
                </div>
              </div>
              <div className="card-sep" />
              <div className="card-body" style={{ paddingTop: 0 }}>
                {waiting.map((row) => (
                  <Row key={row.id} row={row} />
                ))}
              </div>
            </section>
          ) : null}

          <section className="card">
            <div className="card-head">
              <h3>All assignments</h3>
              <div className="acts">
                <span className="t-xs muted">{data.items.length} total</span>
              </div>
            </div>
            <div className="card-sep" />
            <div className="card-body" style={{ paddingTop: 0 }}>
              {data.items.length === 0 ? (
                <div className="empty" style={{ border: 0 }}>
                  <h3>No assignments yet</h3>
                  <p>
                    Invite a creator from the catalog. The fee you offer is held in escrow the moment
                    they accept.
                  </p>
                  <Link className="btn" href="/brand/catalog">
                    Open the catalog
                  </Link>
                </div>
              ) : (
                data.items.map((row) => <Row key={row.id} row={row} />)
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function Row({ row }: { row: CollabRow }) {
  const agreed = row.counterFeeMinor ?? row.feeMinor;

  return (
    <div className="collab-row">
      <div>
        <div className="collab-who">
          <span className="av">{initials(row.creatorName)}</span>
          <span>
            <span className="collab-name">{row.creatorName}</span>
            <span className="collab-sub">
              {row.reference} · {row.campaignTitle}
            </span>
          </span>
        </div>

        <div className="collab-meta">
          <span>
            <span className="k">State</span>
            <span className={`pill ${STATE_TONE[row.state] ?? ''}`}>
              <span className="d" />
              {STATE_LABEL[row.state] ?? row.state}
            </span>
          </span>
          <span>
            <span className="k">Fee</span>
            <span className="v">
              {row.counterFeeMinor === null ? (
                money(row.feeMinor)
              ) : (
                <>
                  <s style={{ color: 'var(--muted)', fontWeight: 400 }}>{money(row.feeMinor)}</s>{' '}
                  {money(agreed)}
                </>
              )}
            </span>
          </span>
          <span>
            <span className="k">Rounds</span>
            <span className="v">{row.counterRounds} of 3</span>
          </span>
          <span>
            <span className="k">Tracked link</span>
            <span className="v" style={{ color: row.trackedLink ? 'var(--blue)' : undefined }}>
              {row.trackedLink ?? 'On approval'}
            </span>
          </span>
        </div>

        {row.state === 'draft_submitted' && row.draft ? (
          <p className="collab-draft">{row.draft}</p>
        ) : null}
      </div>

      <div className="collab-right">
        <CollabActions id={row.id} side="brand" allowed={row.allowed} feeMinor={agreed} />
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  foot
}: {
  icon: 'inbox' | 'bell' | 'wallet' | 'check';
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
