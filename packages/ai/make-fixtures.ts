import JSZip from 'jszip';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { mkdir } from 'node:fs/promises';

const BRIEF = [
  'Structured scorecards launch in September.',
  'Buyers are heads of talent at companies between fifty and five hundred people.',
  'Interview structure lives in spreadsheets nobody opens during the interview.',
  'The post should argue that an unstructured loop is a decision-rights problem.'
];

await mkdir('fixtures', { recursive: true });

const pdf = await PDFDocument.create();
const font = await pdf.embedFont(StandardFonts.Helvetica);
const page = pdf.addPage([595, 842]);
BRIEF.forEach((line, index) => {
  page.drawText(line, { x: 48, y: 780 - index * 24, size: 11, font });
});
await Bun.write('fixtures/brief.pdf', await pdf.save());

const paragraphs = BRIEF.map((line) => `<w:p><w:r><w:t>${line}</w:t></w:r></w:p>`).join('');
const docx = new JSZip();
docx.file(
  '[Content_Types].xml',
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
);
docx.file(
  '_rels/.rels',
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
);
docx.file(
  'word/document.xml',
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}</w:body></w:document>`
);
await Bun.write('fixtures/brief.docx', await docx.generateAsync({ type: 'uint8array' }));

const slide = (lines: string[]) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree>${lines
    .map((line) => `<p:sp><p:txBody><a:p><a:r><a:t>${line}</a:t></a:r></a:p></p:txBody></p:sp>`)
    .join('')}</p:spTree></p:cSld></p:sld>`;

const pptx = new JSZip();
pptx.file(
  '[Content_Types].xml',
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/></Types>`
);
pptx.file('ppt/slides/slide1.xml', slide(BRIEF.slice(0, 2)));
pptx.file('ppt/slides/slide2.xml', slide(BRIEF.slice(2)));
await Bun.write('fixtures/brief.pptx', await pptx.generateAsync({ type: 'uint8array' }));

console.log('fixtures written');
