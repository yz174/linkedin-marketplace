import { expect, test } from 'bun:test';
import JSZip from 'jszip';
import {
  documentKind,
  extractDocument,
  EmptyDocumentError,
  UnsupportedDocumentError
} from './documents';

const fixture = (name: string) =>
  Bun.file(new URL(`../fixtures/${name}`, import.meta.url)).bytes();

test('a PDF yields its text on the Bun runtime', async () => {
  const result = await extractDocument('brief.pdf', await fixture('brief.pdf'));
  expect(result.kind).toBe('pdf');
  expect(result.text).toContain('Structured scorecards launch in September.');
  expect(result.text).toContain('decision-rights problem');
});

test('a DOCX yields its paragraphs', async () => {
  const result = await extractDocument('brief.docx', await fixture('brief.docx'));
  expect(result.kind).toBe('docx');
  expect(result.text).toContain('heads of talent');
  expect(result.text).toContain('decision-rights problem');
});

test('a PPTX yields every slide in order', async () => {
  const result = await extractDocument('brief.pptx', await fixture('brief.pptx'));
  expect(result.kind).toBe('pptx');
  expect(result.text.indexOf('Structured scorecards')).toBeLessThan(
    result.text.indexOf('decision-rights problem')
  );
});

test('an unsupported extension is named in the error', () => {
  expect(() => documentKind('brief.key')).toThrow(UnsupportedDocumentError);
});

test('a deck with no readable text is refused rather than sent to the model', async () => {
  const zip = new JSZip();
  zip.file('ppt/slides/slide1.xml', '<p:sld></p:sld>');
  const bytes = await zip.generateAsync({ type: 'uint8array' });

  let thrown: unknown;
  try {
    await extractDocument('empty.pptx', bytes);
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(EmptyDocumentError);
});

test('EmptyDocumentError says what it wants instead', () => {
  expect(new EmptyDocumentError('scan.pdf').message).toContain('OCR');
});
