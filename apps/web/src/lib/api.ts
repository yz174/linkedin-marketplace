import { ApiError } from '@lm/contracts';
import type { z } from 'zod';

const SERVER_BASE = process.env.API_URL ?? 'http://localhost:3001';
const BROWSER_BASE = '/bff';

export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiFailure';
  }
}

type Options = {
  method?: 'GET' | 'POST';
  body?: unknown;
  cookie?: string;
};

export async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  options: Options = {}
): Promise<T> {
  const onServer = typeof window === 'undefined';
  const url = `${onServer ? SERVER_BASE : BROWSER_BASE}${path}`;

  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.cookie) headers.cookie = options.cookie;

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: onServer ? undefined : 'include',
    cache: 'no-store'
  });

  const text = await response.text();
  const payload: unknown = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const parsed = ApiError.safeParse(payload);
    throw new ApiFailure(
      response.status,
      parsed.success ? parsed.data.code : 'validation_failed',
      parsed.success ? parsed.data.message : `Request to ${path} failed`
    );
  }

  return schema.parse(payload);
}
