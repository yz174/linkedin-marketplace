import { CampaignDraft } from '@lm/contracts';
import { complete } from './openrouter';
import { ThinPageError } from './icp';
import { readPage } from './scrape';

const JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'objective', 'keyMessages', 'doNot', 'deliverable'],
  properties: {
    title: { type: 'string', minLength: 3, maxLength: 160 },
    objective: { type: 'string', minLength: 20, maxLength: 1000 },
    keyMessages: { type: 'array', minItems: 2, maxItems: 5, items: { type: 'string' } },
    doNot: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'string' } },
    deliverable: { type: 'string', minLength: 10, maxLength: 300 }
  }
} as const;

const SYSTEM = [
  'You turn a company page or a marketing brief into a campaign brief for one sponsored LinkedIn post.',
  'The creator writes in their own voice, so give them an argument to make, never copy to paste.',
  'Title names the campaign in under eight words. It is an internal label, not a headline.',
  'Objective is one sentence on what the reader should believe or do differently. Write it about the reader situation and do not name the company in it.',
  'Key messages are claims about the reader problem that the source text supports. At most one of them may name the company or its product.',
  'Do not entries are argument traps for this source: an angle the page cannot support, an opening that starts from the product, an overstated claim. Each one names something specific from the source. Never write a rule about word choice.',
  'Deliverable states format and length only, such as one LinkedIn post of 150 to 250 words carrying a tracked link. It never restates the argument.',
  'Your own writing stays plain and avoids these words: seamless, powerful, effortless, leverage, robust, unlock, game-changing, cutting-edge, empower, streamline.',
  'Never use an em dash. If the source does not support a claim, leave it out rather than guessing.'
].join(' ');

export type CampaignSource = 'url' | 'pasted';

export type DraftedCampaign = {
  draft: CampaignDraft;
  source: CampaignSource;
  sourceRef: string;
  charsRead: number;
  model: string;
  repaired: boolean;
};

export async function draftCampaign(input: {
  url?: string;
  pastedBrief?: string;
  companyName?: string;
}): Promise<DraftedCampaign> {
  const pasted = input.pastedBrief?.trim();
  const page = pasted ? null : await readPage(input.url!);

  if (page?.thin) throw new ThinPageError(input.url!, page.text.length);

  const body = pasted ?? page!.text;

  const { data, model, repaired } = await complete({
    system: SYSTEM,
    user: [
      input.companyName ? `Company: ${input.companyName}` : null,
      page?.title ? `Page title: ${page.title}` : null,
      '',
      body.slice(0, 12_000)
    ]
      .filter((line) => line !== null)
      .join('\n'),
    schema: CampaignDraft,
    schemaName: 'campaign_draft',
    jsonSchema: JSON_SCHEMA
  });

  return {
    draft: data,
    source: pasted ? 'pasted' : 'url',
    sourceRef: pasted ? 'pasted brief' : input.url!,
    charsRead: body.length,
    model,
    repaired
  };
}
