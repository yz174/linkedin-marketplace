import { AuthForm } from '@/components/auth-form';
import { landingFrom } from '@/lib/landing';

export default async function BrandLogin({
  searchParams
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="gate">
      <AuthForm side="brand" mode="login" landing={landingFrom(next, '/brand/catalog')} />
    </main>
  );
}
