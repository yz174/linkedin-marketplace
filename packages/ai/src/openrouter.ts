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

async function callModel(messages: Message[], opts: { schemaName: string; jsonSchema: Record<string, unknown>; maxTokens: number }) {
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
      response_format: {
        type: 'json_schema',
        json_schema: { name: opts.schemaName, strict: true, schema: opts.jsonSchema }
      },
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
  return JSON.parse(candidate) as unknown;
}

export async function complete<T>(opts: CompleteOptions<T>): Promise<CompleteResult<T>> {
  const maxTokens = opts.maxTokens ?? 1500;
  const messages: Message[] = [
    { role: 'system', content: opts.system },
    { role: 'user', content: opts.user }
  ];

  const first = await callModel(messages, {
    schemaName: opts.schemaName,
    jsonSchema: opts.jsonSchema,
    maxTokens
  });

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

  const second = await callModel(repairMessages, {
    schemaName: opts.schemaName,
    jsonSchema: opts.jsonSchema,
    maxTokens
  });

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
