import { Team } from '@lm/contracts';
import { cookies } from 'next/headers';
import { BRAND_NAV, Sidebar } from '@/components/shell';
import { request } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookie = (await cookies()).toString();
  const team = await request('/brand/team', Team, { cookie }).catch(() => null);

  return (
    <div className="shell">
      <Sidebar
        groups={BRAND_NAV}
        name={team?.workspaceName ?? 'Loopwork'}
        sub={team ? `Workspace · ${team.yourRole}` : 'Workspace'}
        glyph={(team?.workspaceName ?? 'Loopwork').slice(0, 1).toUpperCase()}
      />
      <div className="main">{children}</div>
    </div>
  );
}
