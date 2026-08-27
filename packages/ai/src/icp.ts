import { Icp, SECTORS } from '@lm/contracts';
import { complete } from './openrouter';
import { readPage, THIN_CONTENT_THRESHOLD } from './scrape';

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
    schema: Icp,
    schemaName: 'icp',
    jsonSchema: JSON_SCHEMA
  });

  return { icp: data, source, charsRead, model, repaired };
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
