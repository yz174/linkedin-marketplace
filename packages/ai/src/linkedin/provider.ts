import type { Fingerprint, RawLinkedInProfile, RawPost } from '@lm/contracts';

export type FetchResult = {
  profile: RawLinkedInProfile;
  fingerprint: Fingerprint;
  provider: 'scrapecreators' | 'manual';
  creditsUsed: number;
};

export interface LinkedInProfileProvider {
  readonly name: 'scrapecreators' | 'manual';
  fetchProfile(profileUrl: string, pasted?: string): Promise<FetchResult>;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function buildFingerprint(posts: RawPost[], followers: number): Fingerprint {
  const dated = posts
    .map((p) => (p.postedAt ? Date.parse(p.postedAt) : Number.NaN))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);

  const spanMs = dated.length >= 2 ? dated[dated.length - 1]! - dated[0]! : 0;
  const postsPerWeek = spanMs > 0 ? (dated.length - 1) / (spanMs / WEEK_MS) : 0;

  const engaged = posts.filter((p) => p.reactions !== null || p.comments !== null);
  const interactions = engaged.reduce((sum, p) => sum + (p.reactions ?? 0) + (p.comments ?? 0), 0);

  const engagementRate =
    engaged.length === 0 || followers === 0
      ? null
      : Math.min(1, interactions / engaged.length / followers);

  return {
    engagementRate,
    postsPerWeek: Number(postsPerWeek.toFixed(2)),
    postsSampled: posts.length,
    postsWithEngagement: engaged.length,
    corpus: posts
      .map((p) => p.text.trim())
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 8000)
  };
}
