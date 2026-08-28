import { BrandProfile, CreatorCard } from '@lm/contracts';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { EntrySurface } from '@/components/entry-surface';
import { landingFrom } from '@/lib/landing';
import { ApiFailure, request } from '@/lib/api';

export const dynamic = 'force-dynamic';

type Role = 'creator' | 'brand';

export default async function Home({
  searchParams
}: {
  searchParams: Promise<{ role?: string; mode?: string; next?: string }>;
}) {
  const { role: roleParam, mode: modeParam, next } = await searchParams;
  const role: Role = roleParam === 'brand' ? 'brand' : 'creator';
  const mode = modeParam === 'signup' ? 'signup' : 'login';
  const cookie = (await cookies()).toString();

  let step: 'auth' | 'onboarding' = 'auth';
  let onboarded = false;
  let wrongType = false;

  try {
    if (role === 'brand') await request('/brand/profile', BrandProfile, { cookie });
    else await request('/creator/profile', CreatorCard, { cookie });
    onboarded = true;
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 404) step = 'onboarding';
    else if (error instanceof ApiFailure && error.status === 401) step = 'auth';
    else if (error instanceof ApiFailure && error.status === 403) wrongType = true;
    else throw error;
  }

  if (onboarded) redirect(landingFrom(next, role === 'brand' ? '/brand/catalog' : '/creator/dashboard'));
  if (wrongType) redirect(role === 'brand' ? '/?role=creator' : '/?role=brand');

  return <EntrySurface initialRole={role} initialStep={step} initialMode={mode} next={next} />;
}
