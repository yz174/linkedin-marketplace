import { AuthForm } from '@/components/auth-form';

export default function CreatorLogin() {
  return (
    <main className="gate">
      <AuthForm side="creator" mode="login" landing="/creator/card" />
    </main>
  );
}
