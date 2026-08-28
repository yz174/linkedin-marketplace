import { CreatorCard } from '@lm/contracts';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { CreatorOnboarding } from '@/components/creator-onboarding';
import { ApiFailure, request } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function CreatorOnboardingPage() {
  const cookie = (await cookies()).toString();

  try {
    await request('/creator/profile', CreatorCard, { cookie });
  } catch (error) {
    if (error instanceof ApiFailure && (error.status === 401 || error.status === 404)) {
      redirect('/?role=creator');
    }
    throw error;
  }

  return (
    <main className="onb-page">
      <div className="onb-mark">L</div>
      <CreatorOnboarding />
    </main>
  );
}
