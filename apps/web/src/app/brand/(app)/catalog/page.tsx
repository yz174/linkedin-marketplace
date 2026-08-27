import { CatalogResponse, type MatchedCreator } from '@lm/contracts';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/icon';
import { CommissionButton } from '@/components/commission-button';
import { Topbar } from '@/components/shell';
import { ApiFailure, request } from '@/lib/api';
import { count, initials, money, percent } from '@/lib/format';

export const dynamic = 'force-dynamic';

const CampaignList = z.object({
  items: z.array(z.object({ id: z.string().uuid(), title: z.string() }))
});

type View = 'matched' | 'all';

export default async function CatalogPage({
  searchParams
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const view: View = (await searchParams).view === 'all' ? 'all' : 'matched';
  const cookie = (await cookies()).toString();

  let catalog: CatalogResponse;
  try {
    catalog = await request(`/brand/catalog?view=${view}&limit=24`, CatalogResponse, { cookie });
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 401) redirect('/brand/login');
    if (error instanceof ApiFailure && error.status === 403) redirect('/creator/card');
    if (error instanceof ApiFailure && error.status === 404) return <NeedsOnboarding />;
    throw error;
  }

  const campaigns = await request('/brand/campaigns', CampaignList, { cookie }).catch(() => ({
    items: []
  }));

  const bestFee = catalog.items.reduce((sum, i) => sum + i.creator.ratePerPostMinor, 0);
  const engagements = catalog.items
    .map((i) => i.creator.engagementRate)
    .filter((e): e is number => e !== null);
  const median = engagements.length
    ? [...engagements].sort((a, b) => a - b)[Math.floor(engagements.length / 2)]!
    : null;

  return (
    <>
      <Topbar
        placeholder="Search creators, campaigns, assignments"
        right={
          <>
            <button className="btn ghost sm">
              <Icon name="cal" size="sm" />
              Last 30 days
              <Icon name="down" size="sm" />
            </button>
            <button className="iconbtn">
              <Icon name="bell" size="lg" />
              <span className="ping" />
            </button>
            <span className="av">MK</span>
          </>
        }
      />

      <div className="page">
        <div className="main-in railed">
          <div>
            <div className="pagehead">
              <div>
                <h1>Creator catalog</h1>
                <p>
                  Ranked against your ICP. Every score shows its working, and you can change the
                  weighting.
                </p>
              </div>
              <div className="acts">
                <button className="btn ghost">
                  <Icon name="filter" size="sm" />
                  Filters
                </button>
                <button className="btn ghost">
                  <Icon name="export" size="sm" />
                  Export
                </button>
                <button className="btn">
                  <Icon name="plus" size="sm" />
                  New campaign
                </button>
              </div>
            </div>

            <div className="stats">
              <Stat icon="users" label="Showing" value={count(catalog.total)} foot="of the registered catalog" />
              <Stat icon="wallet" label="If you book all" value={money(bestFee)} foot="at their published rates" />
              <Stat icon="chart" label="Median engagement" value={percent(median)} foot="across this view" />
              <Stat icon="link" label="Tracked links" value="100%" foot="enforced before publish" />
            </div>

            <div className="card" style={{ marginBottom: 'var(--s3)' }}>
              <div className="card-head">
                <div className="seg">
                  <Link
                    className=""
                    href="/brand/catalog?view=matched"
                    aria-selected={view === 'matched'}
                    role="tab"
                  >
                    Matched for you
                  </Link>
                  <Link href="/brand/catalog?view=all" aria-selected={view === 'all'} role="tab">
                    Browse all
                  </Link>
                </div>
                <div className="acts">
                  <span className="t-xs muted">Sorted by match score</span>
                </div>
              </div>
              <div className="card-sep" />
              <div className="card-body" style={{ paddingTop: 'var(--s4)' }}>
                {catalog.items.length === 0 ? (
                  <NoMatches view={view} />
                ) : (
                  <div className="grid3">
                    {catalog.items.map((item) => (
                      <CreatorCard key={item.creator.id} item={item} campaigns={campaigns.items} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <aside className="rail-stack">
            <div className="card">
              <div className="card-head">
                <h3>Match weighting</h3>
              </div>
              <div className="card-body">
                <Weight label="Topic overlap" value={40} />
                <Weight label="What they actually write" value={30} />
                <Weight label="Audience fit" value={15} soft />
                <Weight label="Delivery record" value={10} soft />
                <Weight label="Availability" value={5} soft />
                <p className="note" style={{ marginTop: 'var(--s3)' }}>
                  These are the weights the API scored with. Sliders land next.
                </p>
              </div>
            </div>
          </aside>
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
  icon: 'users' | 'wallet' | 'chart' | 'link';
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

function Weight({ label, value, soft }: { label: string; value: number; soft?: boolean }) {
  return (
    <div className="slider">
      <span className="lab">
        {label} <b>{value}%</b>
      </span>
      <span className="track">
        <i className={soft ? 'soft' : ''} style={{ width: `${value}%` }} />
      </span>
    </div>
  );
}

function CreatorCard({
  item,
  campaigns
}: {
  item: MatchedCreator;
  campaigns: { id: string; title: string }[];
}) {
  const { creator, match } = item;
  const strongest = match.reasons.find((r) => r.strong) ?? match.reasons[0];

  return (
    <article className="person">
      <span className="score">{match.score}</span>
      <div className="who">
        <span className="av lg">{initials(creator.name)}</span>
        <span>
          <span className="nm">{creator.name}</span>
          <span className="role">
            {creator.topics.join(' · ')} · {creator.contributorNumber}
          </span>
        </span>
      </div>

      <p className="why">{strongest?.label ?? 'No evidence recorded yet.'}</p>

      <div className="facts">
        <span className="fact">
          <span className="k">Followers</span>
          <span className="v">{count(creator.followers)}</span>
        </span>
        <span className="fact">
          <span className="k">Engagement</span>
          <span className="v">{percent(creator.engagementRate)}</span>
        </span>
        <span className="fact">
          <span className="k">Per post</span>
          <span className="v">{money(creator.ratePerPostMinor)}</span>
        </span>
      </div>

      <div className="person-foot">
        {creator.deliveryRate === null ? (
          <span className="pill">New creator</span>
        ) : (
          <span className="pill ok">
            <span className="d" />
            {percent(creator.deliveryRate, 0)} delivery
          </span>
        )}
        <CommissionButton
          creatorId={creator.id}
          creatorName={creator.name}
          ratePerPostMinor={creator.ratePerPostMinor}
          campaigns={campaigns}
        />
      </div>
    </article>
  );
}

function NoMatches({ view }: { view: View }) {
  return (
    <div className="empty">
      <h3>{view === 'matched' ? 'Nothing matches your ICP yet' : 'No creators registered yet'}</h3>
      <p>
        {view === 'matched'
          ? 'No registered creator shares a sector with your ICP. Browse everyone to see who is here.'
          : 'Run bun run db:seed to load a development catalog.'}
      </p>
      {view === 'matched' ? (
        <Link className="btn" href="/brand/catalog?view=all">
          Browse all creators
        </Link>
      ) : null}
    </div>
  );
}

function NeedsOnboarding() {
  return (
    <div className="page">
      <div className="empty" style={{ maxWidth: 560, margin: '10vh auto' }}>
        <h3>Finish onboarding first</h3>
        <p>
          The catalog ranks creators against your ICP, so we need to know what you sell before it
          means anything.
        </p>
        <Link className="btn" href="/brand/onboarding">
          Build your ICP
        </Link>
      </div>
    </div>
  );
}
