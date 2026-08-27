import type { RawLinkedInProfile, RawPost } from '@lm/contracts';
import { env } from '../env';
import { buildFingerprint, type FetchResult, type LinkedInProfileProvider } from './provider';

const BASE = 'https://api.scrapecreators.com/v1/linkedin';

type ProfileResponse = {
  success?: boolean;
  name?: string;
  image?: string | null;
  about?: string | null;
  location?: string | null;
  followers?: number;
  recentPosts?: { link?: string; title?: string; datePublished?: string; activityType?: string }[];
};

type PostResponse = {
  url?: string;
  description?: string;
  datePublished?: string;
  likeCount?: number;
  commentCount?: number;
};

async function get<T>(path: string, url: string): Promise<T> {
  const key = env().SCRAPECREATORS_API_KEY;
  if (!key) throw new Error('SCRAPECREATORS_API_KEY is not set');

  const target = new URL(`${BASE}${path}`);
  target.searchParams.set('url', url);

  const response = await fetch(target, { headers: { 'x-api-key': key } });
  const body = (await response.json()) as T & { success?: boolean; message?: string };

  if (!response.ok || body.success === false) {
    throw new Error(`ScrapeCreators ${response.status}: ${body.message ?? 'request failed'}`);
  }
  return body;
}

export class ScrapeCreatorsProvider implements LinkedInProfileProvider {
  readonly name = 'scrapecreators' as const;

  async fetchProfile(profileUrl: string): Promise<FetchResult> {
    const profile = await get<ProfileResponse>('/profile', profileUrl);

    if (!profile.name) throw new Error('ScrapeCreators returned no name for this profile');

    const listed = (profile.recentPosts ?? []).filter((p) => p.link);
    const enrichCount = Math.min(env().LINKEDIN_ENRICH_POSTS, listed.length);
    const enriched = await this.enrich(listed.slice(0, enrichCount));

    const posts: RawPost[] = listed.map((p, index) => {
      const detail = index < enriched.length ? enriched[index] : undefined;
      return {
        url: p.link!,
        text: (detail?.description ?? p.title ?? '').trim(),
        reactions: detail?.likeCount ?? null,
        comments: detail?.commentCount ?? null,
        postedAt: p.datePublished ?? detail?.datePublished ?? null
      };
    });

    const followers = profile.followers ?? 0;

    const raw: RawLinkedInProfile = {
      name: profile.name,
      headline: (profile.about ?? '').split('\n')[0]?.slice(0, 300) ?? '',
      about: profile.about ?? '',
      photoUrl: profile.image ?? null,
      followers,
      posts
    };

    return {
      profile: raw,
      fingerprint: buildFingerprint(posts, followers),
      provider: this.name,
      creditsUsed: 1 + enriched.length
    };
  }

  private async enrich(posts: { link?: string }[]) {
    const results: PostResponse[] = [];
    for (const post of posts) {
      if (!post.link) continue;
      try {
        results.push(await get<PostResponse>('/post', post.link));
      } catch {
        results.push({});
      }
    }
    return results;
  }
}
