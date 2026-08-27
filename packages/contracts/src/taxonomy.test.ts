import { expect, test } from 'bun:test';
import { MAX_TAGS, SECTORS, SectorPicks } from './taxonomy';

test('sector list has no duplicates', () => {
  expect(new Set(SECTORS).size).toBe(SECTORS.length);
});

test('accepts one to three sectors', () => {
  expect(SectorPicks.safeParse(['RevOps']).success).toBe(true);
  expect(SectorPicks.safeParse(['RevOps', 'Sales', 'B2B SaaS']).success).toBe(true);
});

test('rejects more than three sectors', () => {
  const four = SECTORS.slice(0, MAX_TAGS + 1);
  expect(SectorPicks.safeParse(four).success).toBe(false);
});

test('rejects an empty pick', () => {
  expect(SectorPicks.safeParse([]).success).toBe(false);
});

test('rejects duplicates', () => {
  expect(SectorPicks.safeParse(['RevOps', 'RevOps']).success).toBe(false);
});

test('rejects a sector outside the taxonomy', () => {
  expect(SectorPicks.safeParse(['Cryptocurrency']).success).toBe(false);
});
