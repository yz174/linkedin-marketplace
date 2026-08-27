import { z } from 'zod';
import { SectorPicks } from './taxonomy';

export const LinkedInUrl = z
  .string()
  .trim()
  .url()
  .refine((u) => /(^|\.)linkedin\.com$/.test(new URL(u).hostname), {
    message: 'Must be a linkedin.com URL'
  })
  .refine((u) => new URL(u).pathname.startsWith('/in/'), {
    message: 'Must be a personal profile URL, /in/...'
  });

export const RawPost = z.object({
  url: z.string().url(),
  text: z.string(),
  reactions: z.number().int().nonnegative().nullable(),
  comments: z.number().int().nonnegative().nullable(),
  postedAt: z.string().datetime().nullable()
});
export type RawPost = z.infer<typeof RawPost>;

export const RawLinkedInProfile = z.object({
  name: z.string().trim().min(1),
  headline: z.string().trim().default(''),
  about: z.string().trim().default(''),
  photoUrl: z.string().url().nullable().default(null),
  followers: z.number().int().nonnegative(),
  posts: z.array(RawPost)
});
export type RawLinkedInProfile = z.infer<typeof RawLinkedInProfile>;

export const FetchProfileRequest = z.object({
  profileUrl: LinkedInUrl,
  pastedProfile: z.string().trim().max(20000).optional()
});
export type FetchProfileRequest = z.infer<typeof FetchProfileRequest>;

export const Fingerprint = z.object({
  engagementRate: z.number().min(0).max(1).nullable(),
  postsPerWeek: z.number().min(0),
  postsSampled: z.number().int().nonnegative(),
  postsWithEngagement: z.number().int().nonnegative(),
  corpus: z.string()
});
export type Fingerprint = z.infer<typeof Fingerprint>;

export const FetchProfileResponse = z.object({
  profile: RawLinkedInProfile,
  fingerprint: Fingerprint,
  provider: z.enum(['scrapecreators', 'manual']),
  fetchedAt: z.string().datetime()
});
export type FetchProfileResponse = z.infer<typeof FetchProfileResponse>;

export const SaveCreatorProfile = z.object({
  profileUrl: LinkedInUrl,
  name: z.string().trim().min(1).max(120),
  headline: z.string().trim().max(300),
  bio: z.string().trim().max(600),
  topics: SectorPicks,
  ratePerPostMinor: z.number().int().min(0).max(100_000_00)
});
export type SaveCreatorProfile = z.infer<typeof SaveCreatorProfile>;

export const CreatorCard = z.object({
  id: z.string().uuid(),
  name: z.string(),
  headline: z.string(),
  photoUrl: z.string().url().nullable(),
  contributorNumber: z.string(),
  topics: SectorPicks,
  followers: z.number().int().nonnegative(),
  engagementRate: z.number().min(0).max(1).nullable(),
  postsPerWeek: z.number().min(0),
  ratePerPostMinor: z.number().int().nonnegative(),
  deliveryRate: z.number().min(0).max(1).nullable(),
  deliveredCount: z.number().int().nonnegative(),
  acceptedCount: z.number().int().nonnegative()
});
export type CreatorCard = z.infer<typeof CreatorCard>;
