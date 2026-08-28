import { Team } from '@lm/contracts';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { BRAND_NAV, Sidebar } from '@/components/shell';
import { ApiFailure, request } from '@/lib/api';
import { initials } from '@/lib/format';

export const dynamic = 'force-dynamic';

const Me = z.object({ email: z.string() });

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookie = (await cookies()).toString();

  let team: Team;
  try {
    team = await request('/brand/team', Team, { cookie });
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 401) redirect('/?role=brand');
    if (error instanceof ApiFailure && error.status === 403) redirect('/creator/card');
    if (error instanceof ApiFailure && error.status === 404) redirect('/?role=brand');
    throw error;
  }

  const me = await request('/brand/me', Me, { cookie }).catch(() => null);
  const email = me?.email ?? '';

  return (
    <div className="shell">
      <Sidebar
        groups={BRAND_NAV}
        name={team.workspaceName}
        sub={`Workspace · ${team.yourRole}`}
        glyph={team.workspaceName.slice(0, 1).toUpperCase()}
        side="brand"
        account={{ label: email || 'Account', initials: initials(email || 'Account') }}
      />
      <div className="main">{children}</div>
    </div>
  );
}
