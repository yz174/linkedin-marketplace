import { expect, test } from 'bun:test';
import { DEFAULT_WEIGHTS, type Sector } from '@lm/contracts';
import {
  type BrandInput,
  type CreatorInput,
  audienceFit,
  cosine,
  deliveryRate,
  rankCreators,
  normalizeCosine,
  reliability,
  scoreCreator,
  SEMANTIC_CEILING,
  SEMANTIC_FLOOR,
  tagAffinity
} from './score';

const creator = (over: Partial<CreatorInput> = {}): CreatorInput => ({
  topics: ['RevOps'],
  followers: 8_000,
  engagementRate: 0.05,
  postsPerWeek: 2,
  ratePerPostMinor: 34_000,
  acceptedCount: 10,
  deliveredCount: 9,
  openSlots: 2,
  ...over
});

test('tag affinity rewards a first-choice match over a third-choice one', () => {
  const brand: readonly Sector[] = ['HR Tech', 'Recruiting', 'B2B SaaS'];
  const first = tagAffinity(brand, ['HR Tech']);
  const third = tagAffinity(brand, ['B2B SaaS']);
  expect(first).toBeGreaterThan(third);
});

test('tag affinity is 1 for an exact ordered match', () => {
  const tags: readonly Sector[] = ['HR Tech', 'Recruiting', 'B2B SaaS'];
  expect(tagAffinity(tags, tags)).toBeCloseTo(1, 5);
});

test('tag affinity is 0 with no overlap', () => {
  expect(tagAffinity(['HR Tech'], ['Gaming'])).toBe(0);
});

test('cosine of identical vectors is 1', () => {
  expect(cosine([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 5);
});

test('cosine of mismatched lengths is 0', () => {
  expect(cosine([1, 2], [1, 2, 3])).toBe(0);
});

test('a new creator sits at the neutral reliability prior', () => {
  expect(reliability(creator({ acceptedCount: 0, deliveredCount: 0 }))).toBeCloseTo(0.5, 5);
});

test('reliability rises with a clean record and falls with a poor one', () => {
  const good = reliability(creator({ acceptedCount: 20, deliveredCount: 20 }));
  const bad = reliability(creator({ acceptedCount: 20, deliveredCount: 6 }));
  expect(good).toBeGreaterThan(0.9);
  expect(bad).toBeLessThan(0.4);
});

test('delivery rate is null until something was accepted', () => {
  expect(deliveryRate(creator({ acceptedCount: 0, deliveredCount: 0 }))).toBeNull();
  expect(deliveryRate(creator({ acceptedCount: 4, deliveredCount: 3 }))).toBeCloseTo(0.75, 5);
});

test('a small high-engagement creator beats a large low-engagement one on audience fit', () => {
  const brand: BrandInput = { sectors: ['HR Tech'] };
  const micro = audienceFit(brand, creator({ followers: 4_000, engagementRate: 0.09 }));
  const macro = audienceFit(brand, creator({ followers: 98_000, engagementRate: 0.008 }));
  expect(micro).toBeGreaterThan(macro);
});

test('audience fit penalises a creator priced over budget', () => {
  const inBudget: BrandInput = { sectors: ['HR Tech'], budgetPerPostMinor: 40_000 };
  const overBudget: BrandInput = { sectors: ['HR Tech'], budgetPerPostMinor: 15_000 };
  expect(audienceFit(inBudget, creator())).toBeGreaterThan(audienceFit(overBudget, creator()));
});

test('score stays within 0 and 100 and reports every component', () => {
  const result = scoreCreator({ sectors: ['RevOps'] }, creator());
  expect(result.score).toBeGreaterThanOrEqual(0);
  expect(result.score).toBeLessThanOrEqual(100);
  expect(Object.keys(result.components).sort()).toEqual(
    ['audienceFit', 'availability', 'reliability', 'semanticFit', 'tagAffinity'].sort()
  );
});

test('semantic fit falls back to neutral when either embedding is missing', () => {
  const withOne = scoreCreator({ sectors: ['RevOps'], icpEmbedding: [1, 0, 0] }, creator());
  expect(withOne.components.semanticFit).toBeCloseTo(0.5, 5);
});

test('semantic fit uses the embeddings when both are present', () => {
  const aligned = scoreCreator(
    { sectors: ['RevOps'], icpEmbedding: [1, 0, 0] },
    creator({ fingerprintEmbedding: [1, 0, 0] })
  );
  const opposed = scoreCreator(
    { sectors: ['RevOps'], icpEmbedding: [1, 0, 0] },
    creator({ fingerprintEmbedding: [-1, 0, 0] })
  );
  expect(aligned.components.semanticFit).toBeCloseTo(1, 5);
  expect(opposed.components.semanticFit).toBeCloseTo(0, 5);
});

test('cosine normalisation stretches the range real embeddings occupy', () => {
  expect(normalizeCosine(SEMANTIC_FLOOR)).toBe(0);
  expect(normalizeCosine(SEMANTIC_CEILING)).toBe(1);
  expect(normalizeCosine(0.40)).toBe(0);
  expect(normalizeCosine(0.95)).toBe(1);
  expect(normalizeCosine(0.71)).toBeGreaterThan(normalizeCosine(0.58));
});

test('weights change the ordering', () => {
  const brand: BrandInput = { sectors: ['HR Tech'] };
  const onTopic = { id: 'a', creator: creator({ topics: ['HR Tech'], engagementRate: 0.02 }) };
  const offTopic = { id: 'b', creator: creator({ topics: ['Gaming'], engagementRate: 0.14 }) };

  const byTags = rankCreators(brand, [onTopic, offTopic], DEFAULT_WEIGHTS);
  expect(byTags[0]!.id).toBe('a');

  const byAudience = rankCreators(brand, [onTopic, offTopic], {
    tagAffinity: 0,
    semanticFit: 0,
    audienceFit: 1,
    reliability: 0,
    availability: 0
  });
  expect(byAudience[0]!.id).toBe('b');
});

test('a resume-tech brand ranks HR and recruiting creators above fashion and manufacturing', () => {
  const brand: BrandInput = { sectors: ['HR Tech', 'Recruiting', 'B2B SaaS'] };

  const rows = [
    { id: 'fashion', creator: creator({ topics: ['Fashion'], engagementRate: 0.11 }) },
    { id: 'manufacturing', creator: creator({ topics: ['Manufacturing'], engagementRate: 0.1 }) },
    { id: 'hrtech', creator: creator({ topics: ['HR Tech', 'Recruiting'] }) },
    { id: 'recruiting', creator: creator({ topics: ['Recruiting', 'HR Tech'] }) },
    { id: 'gaming', creator: creator({ topics: ['Gaming'], engagementRate: 0.12 }) }
  ];

  const ranked = rankCreators(brand, rows);
  const topTwo = ranked.slice(0, 2).map((r) => r.id);
  const onTopic = ['hrtech', 'recruiting'];

  expect(topTwo).toContain('hrtech');
  expect(topTwo).toContain('recruiting');

  const worstOnTopic = Math.min(
    ...ranked.filter((r) => onTopic.includes(r.id)).map((r) => r.match.score)
  );
  const bestOffTopic = Math.max(
    ...ranked.filter((r) => !onTopic.includes(r.id)).map((r) => r.match.score)
  );
  expect(worstOnTopic).toBeGreaterThan(bestOffTopic);
});

test('ranking is deterministic when scores tie', () => {
  const brand: BrandInput = { sectors: ['RevOps'] };
  const rows = [
    { id: 'b', creator: creator() },
    { id: 'a', creator: creator() }
  ];
  expect(rankCreators(brand, rows).map((r) => r.id)).toEqual(['a', 'b']);
});

test('audience fit falls back to neutral when engagement is unknown', () => {
  const brand: BrandInput = { sectors: ['HR Tech'] };
  expect(audienceFit(brand, creator({ engagementRate: null }))).toBeCloseTo(0.5, 5);
});

test('an unknown engagement rate produces no engagement reason', () => {
  const result = scoreCreator({ sectors: ['RevOps'] }, creator({ engagementRate: null }));
  expect(result.reasons.some((r) => r.component === 'audienceFit')).toBe(false);
});

test('a precomputed semantic fit wins over raw embeddings', () => {
  const result = scoreCreator(
    { sectors: ['RevOps'], icpEmbedding: [1, 0, 0] },
    creator({ fingerprintEmbedding: [-1, 0, 0], semanticFit: 0.9 })
  );
  expect(result.components.semanticFit).toBeCloseTo(0.9, 5);
});

test('a precomputed semantic fit is clamped into range', () => {
  const high = scoreCreator({ sectors: ['RevOps'] }, creator({ semanticFit: 4 }));
  expect(high.components.semanticFit).toBe(1);
});
