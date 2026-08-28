import { BrandProfile } from '@lm/contracts';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { BrandOnboarding } from '@/components/brand-onboarding';
import { ApiFailure, request } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function BrandOnboardingPage() {
  const cookie = (await cookies()).toString();

  try {
    await request('/brand/profile', BrandProfile, { cookie });
  } catch (error) {
    if (error instanceof ApiFailure && (error.status === 401 || error.status === 404)) {
      redirect('/?role=brand');
    }
    throw error;
  }

  return (
    <main className="onb-page">
      <div className="onb-mark">L</div>
      <BrandOnboarding />
    </main>
  );
}
