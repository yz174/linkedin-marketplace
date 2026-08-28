import { Team } from '@lm/contracts';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { TeamPanel } from '@/components/team-panel';
import { ApiFailure, request } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const cookie = (await cookies()).toString();

  let team;
  try {
    team = await request('/brand/team', Team, { cookie });
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 401) redirect('/brand/login');
    if (error instanceof ApiFailure && error.status === 403) redirect('/creator/offers');
    if (error instanceof ApiFailure && error.status === 404) redirect('/brand/onboarding');
    throw error;
  }

  return (
    <div className="page">
      <div className="main-in">
          <div className="pagehead">
            <div>
              <h1>Settings</h1>
              <p>
                Everyone here shares one campaign list, one catalog ranking, and one collaboration
                board. Roles decide who can change the ICP those rankings are built on.
              </p>
            </div>
          </div>

          <TeamPanel team={team} />
      </div>
    </div>
  );
}
