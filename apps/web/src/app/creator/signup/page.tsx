import { AuthForm } from '@/components/auth-form';

export default function CreatorSignup() {
  return (
    <main className="gate">
      <AuthForm side="creator" mode="signup" landing="/creator/onboarding" />
    </main>
  );
}
