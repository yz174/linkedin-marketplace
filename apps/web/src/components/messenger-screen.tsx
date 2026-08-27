import Link from 'next/link';
import { Conversation } from '@/components/conversation';
import { LiveCollabs } from '@/components/live-collabs';
import { Topbar } from '@/components/shell';
import { STATE_LABEL, STATE_TONE, type CollabRow } from '@/lib/collab';
import { money } from '@/lib/format';

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

  return (
    <>
      <LiveCollabs side={side} />
      <Topbar
        placeholder="Search conversations"
        right={<span className="av">{side === 'brand' ? 'B' : 'C'}</span>}
      />

      <div className="page">
        <div className="main-in">
          <div className="pagehead">
            <div>
              <h1>Messenger</h1>
              <p>
                Every conversation belongs to an assignment, so what you agree here stays attached to
                the work it is about.
              </p>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="empty">
              <h3>No conversations yet</h3>
              <p>
                A thread opens as soon as {side === 'brand' ? 'you invite a creator' : 'a brand invites you'}.
              </p>
              <Link className="btn" href={side === 'brand' ? '/brand/catalog' : '/creator/offers'}>
                {side === 'brand' ? 'Open the catalog' : 'See your offers'}
              </Link>
            </div>
          ) : (
            <div className="convo-page">
              <aside className="card" style={{ padding: 'var(--s2)' }}>
                {rows.map((row) => (
                  <Link
                    key={row.id}
                    className="thread-item"
                    href={`/${side}/messenger?thread=${row.id}`}
                    data-on={row.id === active?.id ? '1' : undefined}
                  >
                    <span className="nm">{counterpart(row)}</span>
                    <span className="sub">
                      {row.reference} · {money(row.counterFeeMinor ?? row.feeMinor)}
                    </span>
                    <span
                      className={`pill ${STATE_TONE[row.state] ?? ''}`}
                      style={{ marginTop: '6px' }}
                    >
                      <span className="d" />
                      {STATE_LABEL[row.state] ?? row.state}
                    </span>
                  </Link>
                ))}
              </aside>

              {active ? (
                <Conversation
                  key={active.id}
                  collaborationId={active.id}
                  side={side}
                  counterpartName={counterpart(active)}
                />
              ) : null}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
