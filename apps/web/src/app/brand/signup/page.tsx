import { AuthForm } from '@/components/auth-form';
import { landingFrom } from '@/lib/landing';

export default async function BrandSignup({
  searchParams
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="gate">
      <AuthForm side="brand" mode="signup" landing={landingFrom(next, '/brand/catalog')} />
    </main>
  );
}
