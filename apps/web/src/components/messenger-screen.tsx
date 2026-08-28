import { TERMINAL_STATES, type CollabState } from '@lm/contracts';
import Link from 'next/link';
import { Conversation } from '@/components/conversation';
import { LiveCollabs } from '@/components/live-collabs';
import { STATE_LABEL, STATE_TONE, type CollabRow } from '@/lib/collab';
import { initials, money } from '@/lib/format';

const isClosed = (state: string) => TERMINAL_STATES.includes(state as CollabState);

function when(iso: string) {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 1) return 'Today';
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
}

export function MessengerScreen({
  side,
  rows,
  selected
}: {
  side: 'brand' | 'creator';
  rows: CollabRow[];
  selected?: string;
}) {
  const active = rows.find((r) => r.id === selected) ?? rows[0];
  const counterpart = (row: CollabRow) => (side === 'brand' ? row.creatorName : row.campaignTitle);
  const context = (row: CollabRow) => (side === 'brand' ? row.campaignTitle : row.creatorName);

  const open = rows.filter((r) => !isClosed(r.state));
  const closed = rows.filter((r) => isClosed(r.state));

  return (
    <>
      <LiveCollabs side={side} />

      <div className="page msgr-page">
        {rows.length === 0 ? (
          <div className="empty">
            <h3>No conversations yet</h3>
            <p>
              A thread opens as soon as{' '}
              {side === 'brand' ? 'you invite a creator' : 'a brand invites you'}.
            </p>
            <Link className="btn" href={side === 'brand' ? '/brand/catalog' : '/creator/offers'}>
              {side === 'brand' ? 'Open the catalog' : 'See your offers'}
            </Link>
          </div>
        ) : (
          <div className="msgr">
            <aside className="msgr-list">
              {[
                { label: 'Active', rows: open },
                { label: 'Closed', rows: closed }
              ].map((group) =>
                group.rows.length === 0 ? null : (
                  <div className="msgr-group" key={group.label}>
                    <div className="msgr-group-head">
                      {group.label}
                      <span className="msgr-group-n">{group.rows.length}</span>
                    </div>
                    {group.rows.map((row) => (
                      <Link
                        key={row.id}
                        className="msgr-thread"
                        href={`/${side}/messenger?thread=${row.id}`}
                        data-on={row.id === active?.id ? '1' : undefined}
                      >
                        <span className="av sm">{initials(counterpart(row))}</span>
                        <span className="msgr-thread-main">
                          <span className="msgr-thread-top">
                            <span className="msgr-thread-name">{counterpart(row)}</span>
                            <span className="msgr-thread-when">{when(row.invitedAt)}</span>
                          </span>
                          <span className="msgr-thread-preview">
                            {context(row)} · {row.reference}
                          </span>
                          <span className={`pill ${STATE_TONE[row.state] ?? ''}`}>
                            <span className="d" />
                            {STATE_LABEL[row.state] ?? row.state}
                          </span>
                        </span>
                      </Link>
                    ))}
                  </div>
                )
              )}
            </aside>

            <section className="msgr-main">
              {active ? (
                <Conversation
                  key={active.id}
                  collaborationId={active.id}
                  side={side}
                  counterpartName={counterpart(active)}
                />
              ) : null}
            </section>

            {active ? (
              <aside className="msgr-context">
                <div className="msgr-context-label">Assignment</div>
                <div className="msgr-context-title">{active.campaignTitle}</div>
                <dl className="msgr-context-facts">
                  <div>
                    <dt>Reference</dt>
                    <dd>{active.reference}</dd>
                  </div>
                  <div>
                    <dt>Fee</dt>
                    <dd>{money(active.counterFeeMinor ?? active.feeMinor)}</dd>
                  </div>
                  <div>
                    <dt>State</dt>
                    <dd>{STATE_LABEL[active.state] ?? active.state}</dd>
                  </div>
                  <div>
                    <dt>Counter rounds</dt>
                    <dd>{active.counterRounds} of 3</dd>
                  </div>
                  {active.publishBy ? (
                    <div>
                      <dt>Publish by</dt>
                      <dd>{new Date(active.publishBy).toLocaleDateString('en-IE')}</dd>
                    </div>
                  ) : null}
                  {active.trackedLink ? (
                    <div>
                      <dt>Tracked link</dt>
                      <dd className="msgr-context-link">{active.trackedLink}</dd>
                    </div>
                  ) : null}
                </dl>
                <Link
                  className="btn ghost sm"
                  href={side === 'brand' ? '/brand/collaborations' : '/creator/offers'}
                >
                  Open the assignment
                </Link>
              </aside>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}
