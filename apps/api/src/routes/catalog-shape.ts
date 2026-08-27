import type { CreatorCard } from '@lm/contracts';
import type { creators } from '@lm/db';

type CreatorRow = typeof creators.$inferSelect;

export function contributorNumber(value: number) {
  return String(value).padStart(4, '0');
}

export function toCard(row: CreatorRow): CreatorCard {
  return {
    id: row.id,
    name: row.name,
    headline: row.headline,
    photoUrl: row.photoUrl,
    contributorNumber: contributorNumber(row.contributorNumber),
    topics: row.topics,
    followers: row.followers,
    engagementRate: row.engagementRate,
    postsPerWeek: row.postsPerWeek,
    ratePerPostMinor: row.ratePerPostMinor,
    deliveryRate: row.acceptedCount === 0 ? null : row.deliveredCount / row.acceptedCount,
    deliveredCount: row.deliveredCount,
    acceptedCount: row.acceptedCount
  };
}
