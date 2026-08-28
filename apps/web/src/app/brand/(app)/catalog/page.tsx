import { CatalogResponse, type MatchedCreator } from '@lm/contracts';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/icon';
import { CatalogCard } from '@/components/catalog-card';
import { ApiFailure, request } from '@/lib/api';
import { count, money, percent } from '@/lib/format';

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
    if (error instanceof ApiFailure && error.status === 404) redirect('/brand/onboarding');
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
      <div className="page">
        <div className="main-in">
          <div className="pagehead">
            <div>
              <h1>Creator catalog</h1>
              <p>Ranked against your ICP. Every score shows its working.</p>
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
                  <div className="catalog-grid">
                    {catalog.items.map((item) => (
                      <CatalogCard key={item.creator.id} item={item} campaigns={campaigns.items} />
                    ))}
                  </div>
                )}
              </div>
            </div>
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

