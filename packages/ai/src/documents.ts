import JSZip from 'jszip';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_EXTENSIONS = ['pdf', 'docx', 'pptx'] as const;
export type DocumentKind = (typeof DOCUMENT_EXTENSIONS)[number];

export type ExtractedDocument = {
  kind: DocumentKind;
  text: string;
};

export class UnsupportedDocumentError extends Error {
  constructor(readonly filename: string) {
    super(`Cannot read ${filename}. Upload a PDF, DOCX, or PPTX.`);
    this.name = 'UnsupportedDocumentError';
  }
}

export class EmptyDocumentError extends Error {
  constructor(readonly filename: string) {
    super(`No readable text in ${filename}. A scanned page needs OCR, which we do not run.`);
    this.name = 'EmptyDocumentError';
  }
}

export function documentKind(filename: string): DocumentKind {
  const extension = filename.toLowerCase().split('.').pop();
  const match = DOCUMENT_EXTENSIONS.find((candidate) => candidate === extension);
  if (!match) throw new UnsupportedDocumentError(filename);
  return match;
}

export async function extractDocument(
  filename: string,
  bytes: Uint8Array
): Promise<ExtractedDocument> {
  const kind = documentKind(filename);
  const text = collapse(await readByKind(kind, bytes));
  if (!text) throw new EmptyDocumentError(filename);
  return { kind, text };
}

async function readByKind(kind: DocumentKind, bytes: Uint8Array) {
  if (kind === 'pdf') return readPdf(bytes);
  if (kind === 'docx') return readDocx(bytes);
  return readPptx(bytes);
}

async function readPdf(bytes: Uint8Array) {
  const parser = new PDFParse({ data: bytes });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function readDocx(bytes: Uint8Array) {
  const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return result.value;
}

async function readPptx(bytes: Uint8Array) {
  const zip = await JSZip.loadAsync(bytes);
  const slides = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((a, b) => slideNumber(a) - slideNumber(b));

  const pages: string[] = [];
  for (const path of slides) {
    const xml = await zip.file(path)!.async('string');
    const runs = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((match) => unescapeXml(match[1]!));
    if (runs.length > 0) pages.push(runs.join(' '));
  }
  return pages.join('\n\n');
}

function slideNumber(path: string) {
  return Number(/slide(\d+)\.xml$/.exec(path)?.[1] ?? 0);
}

function unescapeXml(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function collapse(value: string) {
  return value.replace(/[ \t ]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
