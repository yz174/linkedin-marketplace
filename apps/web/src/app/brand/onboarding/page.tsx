import { BrandOnboarding } from '@/components/brand-onboarding';

export const dynamic = 'force-dynamic';

export default function BrandOnboardingPage() {
  return (
    <main className="onb-page">
      <div className="onb-mark">L</div>
      <BrandOnboarding />
    </main>
  );
}
