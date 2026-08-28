import { Icp, SECTORS } from '@lm/contracts';
import { z } from 'zod';
import { complete } from './openrouter';
import { readPage, THIN_CONTENT_THRESHOLD } from './scrape';

// Models honour string maxLength in a json_schema unreliably, so the model call
// validates against relaxed length caps and we trim to the contract limits here.
const LenientIcp = Icp.extend({
  summary: z.string().trim().min(20).max(8000),
  points: z.array(z.string().trim().min(5).max(2000)).min(3).max(8),
  buyerTitles: z.array(z.string().trim().min(2).max(400)).max(8)
});

export function clamp(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;

  const cut = t.slice(0, max);
  const floor = max * 0.6;
  const sentenceEnd = Math.max(
    cut.lastIndexOf('. '),
    cut.lastIndexOf('.\n'),
    cut.lastIndexOf('! '),
    cut.lastIndexOf('? ')
  );
  if (sentenceEnd >= floor) return cut.slice(0, sentenceEnd + 1).trim();

  const wordEnd = cut.lastIndexOf(' ');
  return (wordEnd >= floor ? cut.slice(0, wordEnd) : cut).trim();
}

const JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'points', 'buyerTitles', 'sectors'],
  properties: {
    summary: { type: 'string', minLength: 20, maxLength: 600 },
    points: { type: 'array', minItems: 3, maxItems: 8, items: { type: 'string' } },
    buyerTitles: { type: 'array', maxItems: 8, items: { type: 'string' } },
    sectors: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: { type: 'string', enum: [...SECTORS] }
    }
  }
} as const;

const SYSTEM = [
  'You read a company website and describe who buys the product.',
  'Write plainly. State the real specifics you found. Never write marketing adjectives like seamless, powerful, or effortless.',
  'Keep the summary to two or three sentences, around 400 characters and never over 550.',
  'Keep each ICP point to one sentence, under 250 characters.',
  `Pick between one and three sectors, ordered strongest first, only from this list: ${SECTORS.join(', ')}.`,
  'If the text does not support a claim, leave it out rather than guessing.',
  'Never use an em dash.'
].join(' ');

export type IcpSource = 'scraped' | 'pasted';

export type GeneratedIcp = {
  icp: Icp;
  source: IcpSource;
  charsRead: number;
  model: string;
  repaired: boolean;
};

export async function generateIcp(input: {
  productUrl: string;
  pastedPositioning?: string;
  companyName?: string;
}): Promise<GeneratedIcp> {
  const pasted = input.pastedPositioning?.trim();
  const page = pasted ? null : await readPage(input.productUrl);

  if (!pasted && page?.thin) {
    throw new ThinPageError(input.productUrl, page.text.length);
  }

  const source: IcpSource = pasted ? 'pasted' : 'scraped';
  const body = pasted ?? page!.text;
  const charsRead = body.length;

  const { data, model, repaired } = await complete({
    system: SYSTEM,
    user: [
      input.companyName ? `Company: ${input.companyName}` : null,
      `Source: ${input.productUrl}`,
      page?.title ? `Page title: ${page.title}` : null,
      '',
      body.slice(0, 12_000)
    ]
      .filter((line) => line !== null)
      .join('\n'),
    schema: LenientIcp,
    schemaName: 'icp',
    jsonSchema: JSON_SCHEMA
  });

  const icp = Icp.parse({
    summary: clamp(data.summary, 600),
    points: data.points.map((point) => clamp(point, 300)),
    buyerTitles: data.buyerTitles.map((title) => clamp(title, 80)),
    sectors: data.sectors
  });

  return { icp, source, charsRead, model, repaired };
}

export class ThinPageError extends Error {
  constructor(
    readonly url: string,
    readonly charsRead: number
  ) {
    super(
      `Only ${charsRead} characters of readable text at ${url}, under the ${THIN_CONTENT_THRESHOLD} threshold. Ask for pasted positioning instead.`
    );
    this.name = 'ThinPageError';
  }
}
