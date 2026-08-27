import { AuthForm } from '@/components/auth-form';

export default function BrandLogin() {
  return (
    <main className="gate">
      <AuthForm side="brand" mode="login" landing="/brand/catalog" />
    </main>
  );
}
