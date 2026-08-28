'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthForm } from '@/components/auth-form';
import { BrandOnboarding } from '@/components/brand-onboarding';
import { CreatorOnboarding } from '@/components/creator-onboarding';
import { landingFrom } from '@/lib/landing';
import MorphSlider from './morph-slider';

type Role = 'creator' | 'brand';
type Step = 'auth' | 'onboarding';
type Mode = 'login' | 'signup';

const SLIDES = [
  {
    image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1600&auto=format&fit=crop',
    caption: 'For creators'
  },
  {
    image: 'https://images.unsplash.com/photo-1600880292089-90a7e086ee0c?q=80&w=1600&auto=format&fit=crop',
    caption: 'For brands'
  }
];

const HOME: Record<Role, string> = {
  creator: '/creator/dashboard',
  brand: '/brand/catalog'
};

function isInvite(next: string | undefined) {
  return !!next && (next.startsWith('/brand/invite/') || next.startsWith('/creator/invite/'));
}

export function EntrySurface({
  initialRole,
  initialStep,
  initialMode,
  next
}: {
  initialRole: Role;
  initialStep: Step;
  initialMode: Mode;
  next?: string;
}) {
  const router = useRouter();
  const [role, setRole] = useState<Role>(initialRole);
  const [step, setStep] = useState<Step>(initialStep);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [wide, setWide] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 860px)');
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  async function handleAuthed() {
    if (isInvite(next)) {
      router.push(next!);
      router.refresh();
      return;
    }

    const onboarded = await fetch(`/bff/${role}/profile`, { credentials: 'include' })
      .then((r) => r.ok)
      .catch(() => false);

    if (onboarded) {
      router.push(landingFrom(next, HOME[role]));
      router.refresh();
      return;
    }
    setStep('onboarding');
  }

  return (
    <main className="entry">
      <div className="entry-panel">
        <div className="entry-panel-inner" data-step={step}>
          <div className="auth-mark">Loopwork</div>

          {step === 'auth' ? (
            <div className="entry-auth">
              <p className="entry-cta">Where B2B brands book LinkedIn creators.</p>

              <div className="role-toggle" role="tablist" aria-label="Account type">
                <span className="role-toggle-thumb" data-role={role} aria-hidden="true" />
                <button
                  type="button"
                  role="tab"
                  aria-selected={role === 'creator'}
                  className="role-toggle-opt"
                  onClick={() => setRole('creator')}
                >
                  I&rsquo;m a creator
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={role === 'brand'}
                  className="role-toggle-opt"
                  onClick={() => setRole('brand')}
                >
                  I&rsquo;m a brand
                </button>
              </div>

              <AuthForm
                side={role}
                mode={mode}
                landing={HOME[role]}
                onAuthed={handleAuthed}
                onSwitchMode={setMode}
              />
            </div>
          ) : role === 'brand' ? (
            <BrandOnboarding />
          ) : (
            <CreatorOnboarding />
          )}
        </div>
      </div>

      {wide ? (
        <div className="entry-media">
          <MorphSlider
            items={SLIDES}
            startIndex={initialRole === 'brand' ? 1 : 0}
            activeIndex={role === 'brand' ? 1 : 0}
            transition="melt"
            intensity={0.55}
            aberration={0.35}
            drift={0.4}
            autoplay={false}
            radius={0}
            overlayColor="#021F94"
            showCaptions={false}
            showControls={false}
            showIndicators={false}
          />
          <div className="entry-media-scrim" aria-hidden="true" />
        </div>
      ) : null}
    </main>
  );
}
