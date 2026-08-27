import { RawLinkedInProfile } from '@lm/contracts';
import { z } from 'zod';
import { complete } from '../openrouter';
import { buildFingerprint, type FetchResult, type LinkedInProfileProvider } from './provider';

const Parsed = z.object({
  name: z.string().trim().min(1),
  headline: z.string().trim(),
  about: z.string().trim(),
  followers: z.number().int().nonnegative(),
  posts: z
    .array(
      z.object({
        text: z.string().trim(),
        reactions: z.number().int().nonnegative().nullable(),
        comments: z.number().int().nonnegative().nullable()
      })
    )
});

const JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'headline', 'about', 'followers', 'posts'],
  properties: {
    name: { type: 'string' },
    headline: { type: 'string' },
    about: { type: 'string' },
    followers: { type: 'integer', minimum: 0 },
    posts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'reactions', 'comments'],
        properties: {
          text: { type: 'string' },
          reactions: { type: ['integer', 'null'], minimum: 0 },
          comments: { type: ['integer', 'null'], minimum: 0 }
        }
      }
    }
  }
} as const;

const SYSTEM = [
  'You extract structured data from text a person pasted from their own LinkedIn profile.',
  'Copy values exactly as written. Never invent a follower count, a name, or a post.',
  'If a number is absent, use null for reactions and comments, and 0 for followers.'
].join(' ');

export class ManualPasteProvider implements LinkedInProfileProvider {
  readonly name = 'manual' as const;

  async fetchProfile(profileUrl: string, pasted?: string): Promise<FetchResult> {
    if (!pasted?.trim()) {
      throw new Error('Manual provider needs pasted profile text');
    }

    const { data } = await complete({
      system: SYSTEM,
      user: `Profile URL: ${profileUrl}\n\nPasted text:\n${pasted}`,
      schema: Parsed,
      schemaName: 'linkedin_profile',
      jsonSchema: JSON_SCHEMA
    });

    const posts = data.posts.map((p, index) => ({
      url: `${profileUrl}#pasted-${index}`,
      text: p.text,
      reactions: p.reactions,
      comments: p.comments,
      postedAt: null
    }));

    const profile = RawLinkedInProfile.parse({
      name: data.name,
      headline: data.headline,
      about: data.about,
      photoUrl: null,
      followers: data.followers,
      posts
    });

    return {
      profile,
      fingerprint: buildFingerprint(posts, data.followers),
      provider: this.name,
      creditsUsed: 0
    };
  }
}
