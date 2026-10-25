import fs from 'fs';
import mammoth from 'mammoth';
import path from 'path';

// pdf.js runs its "worker" in the same process when this global is set, so nothing is loaded from disk at runtime
// eslint-disable-next-line @typescript-eslint/no-var-requires
(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = require('pdfjs-dist/legacy/build/pdf.worker.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');

/**
 * The plain text of a CV file: PDF, Word (.docx) or text.
 */
export async function extractCvText(filePath: string): Promise<string> {
  const extension = path.extname(filePath).toLowerCase();
  const data = fs.readFileSync(filePath);

  if (extension === '.docx') {
    const { value } = await mammoth.extractRawText({ buffer: data });
    return tidy(value);
  }

  if (extension === '.pdf') {
    const pdf = await pdfjs.getDocument({
      data: new Uint8Array(data),
      isEvalSupported: false,
      useSystemFonts: true,
      disableFontFace: true,
    }).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      // keep line breaks: pdf.js marks the end of each line with hasEOL
      pages.push(
        content.items
          .map((item: { str?: string; hasEOL?: boolean }) => (item.str ?? '') + (item.hasEOL ? '\n' : ''))
          .join(''),
      );
    }
    await pdf.destroy();
    const text = tidy(pages.join('\n'));
    if (!text) throw new Error("This PDF has no readable text (it may be a scanned image). Try a Word or text version.");
    return text;
  }

  return tidy(data.toString('utf8'));
}

const tidy = (text: string) =>
  text
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
