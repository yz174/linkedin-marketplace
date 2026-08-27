import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { MessengerScreen } from '@/components/messenger-screen';
import { ApiFailure, request } from '@/lib/api';
import { CollabList } from '@/lib/collab';

export const dynamic = 'force-dynamic';

export default async function BrandMessenger({
  searchParams
}: {
  searchParams: Promise<{ thread?: string }>;
}) {
  const cookie = (await cookies()).toString();
  const selected = (await searchParams).thread;

  try {
    const data = await request('/brand/collaborations', CollabList, { cookie });
    return <MessengerScreen side="brand" rows={data.items} selected={selected} />;
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 401) redirect('/brand/login');
    if (error instanceof ApiFailure && error.status === 403) redirect('/creator/messenger');
    if (error instanceof ApiFailure && error.status === 404) redirect('/brand/onboarding');
    throw error;
  }
}
