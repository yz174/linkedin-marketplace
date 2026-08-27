import { z } from 'zod';
import { SectorPicks } from './taxonomy';

export const Icp = z.object({
  summary: z.string().trim().min(20).max(600),
  points: z.array(z.string().trim().min(5).max(300)).min(3).max(8),
  buyerTitles: z.array(z.string().trim().min(2).max(80)).max(8),
  sectors: SectorPicks
});
export type Icp = z.infer<typeof Icp>;

export const GenerateIcpRequest = z.object({
  productUrl: z.string().url(),
  linkedinCompanyUrl: z.string().url().optional(),
  pastedPositioning: z.string().trim().max(8000).optional()
});
export type GenerateIcpRequest = z.infer<typeof GenerateIcpRequest>;

export const GenerateIcpResponse = z.object({
  icp: Icp,
  source: z.enum(['scraped', 'pasted']),
  charsRead: z.number().int().nonnegative(),
  model: z.string()
});
export type GenerateIcpResponse = z.infer<typeof GenerateIcpResponse>;

export const SaveBrandProfile = z.object({
  companyName: z.string().trim().min(1).max(160),
  productUrl: z.string().url(),
  icp: Icp
});
export type SaveBrandProfile = z.infer<typeof SaveBrandProfile>;

export const BrandProfile = SaveBrandProfile.extend({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  updatedAt: z.string().datetime()
});
export type BrandProfile = z.infer<typeof BrandProfile>;
