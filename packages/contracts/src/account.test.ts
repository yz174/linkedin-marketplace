import { expect, test } from 'bun:test';
import { Email, SignUp } from './account';

test('email normalises case and whitespace', () => {
  expect(Email.parse('  Priya@Example.COM ')).toBe('priya@example.com');
});

test('signup requires a known account type', () => {
  const base = { email: 'a@b.com', password: 'a'.repeat(12), name: 'A' };
  expect(SignUp.safeParse({ ...base, accountType: 'brand' }).success).toBe(true);
  expect(SignUp.safeParse({ ...base, accountType: 'admin' }).success).toBe(false);
});

test('signup rejects a short password', () => {
  const r = SignUp.safeParse({ email: 'a@b.com', password: 'short', name: 'A', accountType: 'brand' });
  expect(r.success).toBe(false);
});
