import { expect, test } from 'bun:test';
import type { RawPost } from '@lm/contracts';
import { buildFingerprint } from './provider';

const post = (over: Partial<RawPost> = {}): RawPost => ({
  url: 'https://linkedin.com/posts/x',
  text: 'a post',
  reactions: null,
  comments: null,
  postedAt: null,
  ...over
});

test('engagement is null when no post carries counts', () => {
  const fp = buildFingerprint([post(), post()], 10_000);
  expect(fp.engagementRate).toBeNull();
  expect(fp.postsWithEngagement).toBe(0);
});

test('engagement averages interactions per post over followers', () => {
  const fp = buildFingerprint(
    [post({ reactions: 100, comments: 20 }), post({ reactions: 80, comments: 0 })],
    10_000
  );
  expect(fp.engagementRate).toBeCloseTo(0.01, 6);
  expect(fp.postsWithEngagement).toBe(2);
});

test('posts without counts do not dilute the engagement average', () => {
  const fp = buildFingerprint([post({ reactions: 100, comments: 0 }), post()], 10_000);
  expect(fp.engagementRate).toBeCloseTo(0.01, 6);
  expect(fp.postsWithEngagement).toBe(1);
});

test('engagement is null when follower count is unknown', () => {
  expect(buildFingerprint([post({ reactions: 10, comments: 1 })], 0).engagementRate).toBeNull();
});

test('cadence is computed from the span between first and last post', () => {
  const fp = buildFingerprint(
    [
      post({ postedAt: '2026-08-20T00:00:00.000Z' }),
      post({ postedAt: '2026-08-24T00:00:00.000Z' }),
      post({ postedAt: '2026-08-27T00:00:00.000Z' })
    ],
    1000
  );
  expect(fp.postsPerWeek).toBeCloseTo(2, 1);
});

test('cadence is zero with a single dated post', () => {
  expect(buildFingerprint([post({ postedAt: '2026-08-20T00:00:00.000Z' })], 1000).postsPerWeek).toBe(0);
});

test('corpus joins post text and caps its length', () => {
  const fp = buildFingerprint([post({ text: 'first' }), post({ text: 'second' })], 1000);
  expect(fp.corpus).toBe('first\n\nsecond');
  const long = buildFingerprint([post({ text: 'x'.repeat(20_000) })], 1000);
  expect(long.corpus.length).toBe(8000);
});

test('engagement rate never exceeds 1', () => {
  const fp = buildFingerprint([post({ reactions: 5000, comments: 5000 })], 100);
  expect(fp.engagementRate).toBe(1);
});
