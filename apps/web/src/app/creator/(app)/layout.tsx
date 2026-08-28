import { CreatorCard } from '@lm/contracts';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { CREATOR_NAV, Sidebar } from '@/components/shell';
import { ApiFailure, request } from '@/lib/api';
import { initials } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookie = (await cookies()).toString();

  let card: CreatorCard;
  try {
    card = await request('/creator/profile', CreatorCard, { cookie });
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 401) redirect('/?role=creator');
    if (error instanceof ApiFailure && error.status === 403) redirect('/brand/catalog');
    if (error instanceof ApiFailure && error.status === 404) redirect('/?role=creator');
    throw error;
  }

  return (
    <div className="shell">
      <Sidebar
        groups={CREATOR_NAV}
        name={card.name}
        sub={`Contributor ${card.contributorNumber}`}
        glyph={initials(card.name).slice(0, 1) || 'C'}
        side="creator"
        account={{ label: card.name, initials: initials(card.name) }}
      />
      <div className="main">{children}</div>
    </div>
  );
}
