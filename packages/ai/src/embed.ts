import { env } from './env';

export const EMBEDDING_DIMS = 768;
export const EMBEDDING_MODEL = 'gemini-embedding-001';

const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`;

type TaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';

async function embed(text: string, taskType: TaskType) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Cannot embed empty text');

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'x-goog-api-key': env().GEMINI_API_KEY,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text: trimmed }] },
      taskType,
      outputDimensionality: EMBEDDING_DIMS
    })
  });

  const body = (await response.json()) as {
    embedding?: { values?: number[] };
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(`Gemini ${response.status}: ${body.error?.message ?? 'unknown error'}`);
  }

  const values = body.embedding?.values;
  if (!values || values.length !== EMBEDDING_DIMS) {
    throw new Error(`Gemini returned ${values?.length ?? 0} dimensions, expected ${EMBEDDING_DIMS}`);
  }

  return normalize(values);
}

function normalize(values: number[]) {
  const magnitude = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));
  return magnitude === 0 ? values : values.map((v) => v / magnitude);
}

export function embedDocument(text: string) {
  return embed(text, 'RETRIEVAL_DOCUMENT');
}

export function embedQuery(text: string) {
  return embed(text, 'RETRIEVAL_QUERY');
}
