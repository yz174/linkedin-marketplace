import { z } from 'zod';

export const SECTORS = [
  'DevTools',
  'RevOps',
  'MarTech',
  'FinTech',
  'HR Tech',
  'Recruiting',
  'Sales',
  'Cybersecurity',
  'Data and AI',
  'B2B SaaS',
  'E-commerce',
  'Manufacturing',
  'Logistics',
  'Healthcare',
  'Legal',
  'Real Estate',
  'Education',
  'Design',
  'Fashion',
  'Hospitality',
  'Gaming',
  'Sustainability',
  'Consulting',
  'Hardware'
] as const;

export const MAX_TAGS = 3;

export const Sector = z.enum(SECTORS);
export type Sector = z.infer<typeof Sector>;

export const SectorPicks = z
  .array(Sector)
  .min(1)
  .max(MAX_TAGS)
  .refine((tags) => new Set(tags).size === tags.length, {
    message: 'Sectors must be unique'
  });

export type SectorPicks = z.infer<typeof SectorPicks>;
