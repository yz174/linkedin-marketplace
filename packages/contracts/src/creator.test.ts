import { expect, test } from 'bun:test';
import { LinkedInUrl } from './creator';

test('accepts a personal profile url', () => {
  expect(LinkedInUrl.safeParse('https://www.linkedin.com/in/priya').success).toBe(true);
});

test('rejects a company url', () => {
  expect(LinkedInUrl.safeParse('https://www.linkedin.com/company/loopwork').success).toBe(false);
});

test('rejects a lookalike host', () => {
  expect(LinkedInUrl.safeParse('https://linkedin.com.evil.tld/in/priya').success).toBe(false);
});
