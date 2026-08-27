import { Readability } from '@mozilla/readability';
import { JSDOM, VirtualConsole } from 'jsdom';

export const THIN_CONTENT_THRESHOLD = 400;

export type PageText = {
  url: string;
  title: string;
  text: string;
  thin: boolean;
};

export async function readPage(url: string, timeoutMs = 12_000): Promise<PageText> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; LinkedInMarketplace/0.1)' }
    });
    if (!response.ok) throw new Error(`Fetch ${response.status} for ${url}`);

    const html = await response.text();
    const dom = new JSDOM(html, { url, virtualConsole: new VirtualConsole() });
    stripNonContent(dom.window.document);

    const article = new Readability(dom.window.document.cloneNode(true) as Document).parse();
    const readable = collapse(article?.textContent ?? '');
    const fallback = collapse(dom.window.document.body?.textContent ?? '');
    const text = readable.length >= fallback.length / 4 ? readable : fallback;

    return {
      url,
      title: article?.title ?? dom.window.document.title ?? '',
      text,
      thin: text.length < THIN_CONTENT_THRESHOLD
    };
  } finally {
    clearTimeout(timer);
  }
}

function collapse(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

function stripNonContent(document: Document) {
  const selectors = 'script, style, noscript, svg, template, iframe, link, meta';
  for (const node of Array.from(document.querySelectorAll(selectors))) node.remove();
}
