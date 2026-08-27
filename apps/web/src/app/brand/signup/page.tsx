import { AuthForm } from '@/components/auth-form';

export default function BrandSignup() {
  return (
    <main className="gate">
      <AuthForm side="brand" mode="signup" landing="/brand/catalog" />
    </main>
  );
}
