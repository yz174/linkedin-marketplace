import type { z } from 'zod';
import { env } from './env';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

export type CompleteOptions<T> = {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  maxTokens?: number;
};

export type CompleteResult<T> = {
  data: T;
  model: string;
  repaired: boolean;
};

type Message = { role: 'system' | 'user' | 'assistant'; content: string };

// Free OpenRouter models advertise json_schema support inconsistently and some
// return prose when handed a response_format they cannot honour. Instead the
// schema goes in the prompt and every response is validated (and repaired once).
function schemaDirective(jsonSchema: Record<string, unknown>) {
  return [
    'Return only a single JSON object that satisfies this JSON Schema.',
    'No prose, no explanation, no markdown fences.',
    JSON.stringify(jsonSchema)
  ].join('\n');
}

async function callModel(messages: Message[], opts: { maxTokens: number }) {
  const config = env();
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.OPENROUTER_API_KEY}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: config.OPENROUTER_MODEL,
      models: config.OPENROUTER_FALLBACKS,
      max_tokens: opts.maxTokens,
      messages
    })
  });

  const body = (await response.json()) as {
    model?: string;
    error?: { message?: string };
    choices?: { message?: { content?: string } }[];
  };

  if (!response.ok) {
    throw new Error(`OpenRouter ${response.status}: ${body.error?.message ?? 'unknown error'}`);
  }

  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenRouter returned no content');

  return { content, model: body.model ?? env().OPENROUTER_MODEL };
}

function parseJson(content: string) {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1]?.trim() ?? content.trim();
  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('no JSON object in model output');
    return JSON.parse(candidate.slice(start, end + 1)) as unknown;
  }
}

export async function complete<T>(opts: CompleteOptions<T>): Promise<CompleteResult<T>> {
  const maxTokens = opts.maxTokens ?? 1500;
  const messages: Message[] = [
    { role: 'system', content: `${opts.system}\n\n${schemaDirective(opts.jsonSchema)}` },
    { role: 'user', content: opts.user }
  ];

  const first = await callModel(messages, { maxTokens });

  const attempt = opts.schema.safeParse(safeParseJson(first.content));
  if (attempt.success) return { data: attempt.data, model: first.model, repaired: false };

  const repairMessages: Message[] = [
    ...messages,
    { role: 'assistant', content: first.content },
    {
      role: 'user',
      content: `That response failed validation: ${attempt.error.issues
        .map((i) => `${i.path.join('.') || 'root'}: ${i.message}`)
        .join('; ')}. Return corrected JSON only, matching the schema exactly.`
    }
  ];

  const second = await callModel(repairMessages, { maxTokens });

  const repaired = opts.schema.safeParse(safeParseJson(second.content));
  if (!repaired.success) {
    throw new Error(
      `Model output failed validation twice: ${repaired.error.issues
        .map((i) => `${i.path.join('.') || 'root'}: ${i.message}`)
        .join('; ')}`
    );
  }

  return { data: repaired.data, model: second.model, repaired: true };
}

function safeParseJson(content: string) {
  try {
    return parseJson(content);
  } catch {
    return null;
  }
}
