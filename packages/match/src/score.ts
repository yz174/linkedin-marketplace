import { MAX_TAGS, type Sector } from '@lm/contracts';
import {
  DEFAULT_WEIGHTS,
  type MatchComponent,
  type MatchReason,
  type MatchScore,
  type MatchWeights
} from '@lm/contracts';

export type BrandInput = {
  sectors: readonly Sector[];
  icpEmbedding?: readonly number[];
  budgetPerPostMinor?: number;
};

export type CreatorInput = {
  topics: readonly Sector[];
  followers: number;
  engagementRate: number | null;
  postsPerWeek: number;
  ratePerPostMinor: number;
  acceptedCount: number;
  deliveredCount: number;
  openSlots: number;
  fingerprintEmbedding?: readonly number[];
};

const RELIABILITY_PRIOR_WEIGHT = 4;
const RELIABILITY_PRIOR_VALUE = 0.5;
const NEUTRAL_SEMANTIC_FIT = 0.5;
const NEUTRAL_ENGAGEMENT_FIT = 0.5;
const CADENCE_TARGET_PER_WEEK = 3;
const SLOT_TARGET = 2;

const BANDS = [
  { maxFollowers: 5_000, medianEngagement: 0.075 },
  { maxFollowers: 25_000, medianEngagement: 0.049 },
  { maxFollowers: 50_000, medianEngagement: 0.032 },
  { maxFollowers: Infinity, medianEngagement: 0.021 }
] as const;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

const rankWeight = (index: number) => (MAX_TAGS - index) / MAX_TAGS;

export function bandFor(followers: number) {
  return BANDS.find((b) => followers < b.maxFollowers) ?? BANDS[BANDS.length - 1]!;
}

export function tagAffinity(brandSectors: readonly Sector[], creatorTopics: readonly Sector[]) {
  if (brandSectors.length === 0 || creatorTopics.length === 0) return 0;

  let earned = 0;
  let perfect = 0;

  brandSectors.forEach((sector, brandIndex) => {
    const bw = rankWeight(brandIndex);
    perfect += bw * rankWeight(brandIndex);
    const creatorIndex = creatorTopics.indexOf(sector);
    if (creatorIndex !== -1) earned += bw * rankWeight(creatorIndex);
  });

  return perfect === 0 ? 0 : clamp01(earned / perfect);
}

export function cosine(a: readonly number[], b: readonly number[]) {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function semanticFit(brand: BrandInput, creator: CreatorInput) {
  if (!brand.icpEmbedding || !creator.fingerprintEmbedding) return NEUTRAL_SEMANTIC_FIT;
  return clamp01((cosine(brand.icpEmbedding, creator.fingerprintEmbedding) + 1) / 2);
}

export function audienceFit(brand: BrandInput, creator: CreatorInput) {
  const band = bandFor(creator.followers);
  const engagement =
    creator.engagementRate === null
      ? NEUTRAL_ENGAGEMENT_FIT
      : clamp01(creator.engagementRate / (band.medianEngagement * 2));

  if (brand.budgetPerPostMinor === undefined) return engagement;

  const budget = brand.budgetPerPostMinor;
  const affordability =
    budget <= 0 ? 0 : creator.ratePerPostMinor <= budget ? 1 : clamp01(budget / creator.ratePerPostMinor);

  return clamp01(engagement * 0.7 + affordability * 0.3);
}

export function reliability(creator: CreatorInput) {
  const accepted = Math.max(0, creator.acceptedCount);
  const delivered = Math.max(0, Math.min(creator.deliveredCount, accepted));
  const numerator = delivered + RELIABILITY_PRIOR_VALUE * RELIABILITY_PRIOR_WEIGHT;
  const denominator = accepted + RELIABILITY_PRIOR_WEIGHT;
  return clamp01(numerator / denominator);
}

export function availability(creator: CreatorInput) {
  const cadence = clamp01(creator.postsPerWeek / CADENCE_TARGET_PER_WEEK);
  const slots = clamp01(creator.openSlots / SLOT_TARGET);
  return clamp01(cadence * 0.6 + slots * 0.4);
}

export function hasDeliveryRecord(creator: CreatorInput) {
  return creator.acceptedCount > 0;
}

export function deliveryRate(creator: CreatorInput) {
  return creator.acceptedCount === 0 ? null : creator.deliveredCount / creator.acceptedCount;
}

function buildReasons(
  brand: BrandInput,
  creator: CreatorInput,
  components: Record<MatchComponent, number>
): MatchReason[] {
  const reasons: MatchReason[] = [];
  const shared = brand.sectors.filter((s) => creator.topics.includes(s));

  if (shared.length > 0) {
    reasons.push({
      component: 'tagAffinity',
      label: `Posts about ${shared[0]}`,
      strong: components.tagAffinity >= 0.75
    });
  }

  if (components.semanticFit !== NEUTRAL_SEMANTIC_FIT && components.semanticFit >= 0.7) {
    reasons.push({
      component: 'semanticFit',
      label: 'Writes about what your buyers read',
      strong: components.semanticFit >= 0.85
    });
  }

  const band = bandFor(creator.followers);
  if (creator.engagementRate !== null && creator.engagementRate > band.medianEngagement) {
    reasons.push({
      component: 'audienceFit',
      label: `${(creator.engagementRate * 100).toFixed(1)}% engagement, above the band median`,
      strong: creator.engagementRate >= band.medianEngagement * 1.5
    });
  }

  const rate = deliveryRate(creator);
  if (rate === null) {
    reasons.push({ component: 'reliability', label: 'New creator, no record yet', strong: false });
  } else if (creator.acceptedCount >= 3) {
    reasons.push({
      component: 'reliability',
      label: `Delivered ${creator.deliveredCount} of ${creator.acceptedCount}`,
      strong: rate >= 0.9
    });
  }

  return reasons;
}

export function scoreCreator(
  brand: BrandInput,
  creator: CreatorInput,
  weights: MatchWeights = DEFAULT_WEIGHTS
): MatchScore {
  const components: Record<MatchComponent, number> = {
    tagAffinity: tagAffinity(brand.sectors, creator.topics),
    semanticFit: semanticFit(brand, creator),
    audienceFit: audienceFit(brand, creator),
    reliability: reliability(creator),
    availability: availability(creator)
  };

  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
  if (totalWeight === 0) {
    return { score: 0, components, reasons: buildReasons(brand, creator, components) };
  }

  const weighted = (Object.keys(components) as MatchComponent[]).reduce(
    (sum, key) => sum + components[key] * weights[key],
    0
  );

  return {
    score: Math.round((weighted / totalWeight) * 100),
    components,
    reasons: buildReasons(brand, creator, components)
  };
}

export function rankCreators<T extends { id: string; creator: CreatorInput }>(
  brand: BrandInput,
  rows: readonly T[],
  weights: MatchWeights = DEFAULT_WEIGHTS
) {
  return rows
    .map((row) => ({ ...row, match: scoreCreator(brand, row.creator, weights) }))
    .sort((a, b) => b.match.score - a.match.score || a.id.localeCompare(b.id));
}
