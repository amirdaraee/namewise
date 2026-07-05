import fs from 'fs';
import path from 'path';
import { DocumentParser, ParseResult, DocumentMetadata } from '../types/index.js';
import { PDFToImageConverter } from '../utils/pdf-to-image.js';
import { ParseError } from '../errors.js';

export class PDFParser implements DocumentParser {
  constructor() {
    // No constructor parameters needed anymore
  }

  supports(filePath: string): boolean {
    return path.extname(filePath).toLowerCase() === '.pdf';
  }

  async parse(filePath: string): Promise<ParseResult> {
    try {
      const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');

      const raw = fs.readFileSync(filePath);
      // pdfjs may transfer the buffer to its (fake) worker, so hand it a copy
      // rather than the fs buffer.
      const data = new Uint8Array(raw);

      // Suppress pdfjs noise (both stderr and console.warn) for the entire PDF
      // pipeline — warnings can come from either the text-extraction path or
      // pdf-to-png-converter (scanned path).
      const origStderrWrite = (process.stderr as any).write?.bind(process.stderr);
      const origConsoleWarn = console.warn;
      (process.stderr as any).write = () => true;
      console.warn = () => {};

      let content = '';
      let numPages = 0;
      let info: any = {};

      try {
        const loadingTask = getDocument({ data, verbosity: 0 });
        const doc = await loadingTask.promise;
        try {
          numPages = doc.numPages;

          const meta = await doc.getMetadata().catch(() => undefined);
          info = (meta as any)?.info ?? {};

          const pageTexts: string[] = [];
          for (let i = 1; i <= numPages; i++) {
            const page = await doc.getPage(i);
            const textContent = await page.getTextContent();
            pageTexts.push(
              textContent.items
                .map((item: any) => (typeof item.str === 'string' ? item.str : ''))
                .join(' ')
            );
          }
          content = pageTexts.join('\n\n').trim();
        } finally {
          await loadingTask.destroy();
        }

        if (PDFToImageConverter.isScannedPDF(content)) {
          try {
            const imageBase64 = await PDFToImageConverter.convertFirstPageToBase64(raw);
            content = `[SCANNED_PDF_IMAGE]:${imageBase64}`;
          } catch {
            // Conversion failed; continue with empty content — AI handles gracefully
          }
        }
      } finally {
        if (origStderrWrite) (process.stderr as any).write = origStderrWrite;
        console.warn = origConsoleWarn;
      }

      const metadata: DocumentMetadata = {};

      metadata.title   = info.Title;
      metadata.author  = info.Author;
      metadata.creator = info.Creator;
      metadata.subject = info.Subject;
      if (info.CreationDate) metadata.creationDate = this.parseDate(info.CreationDate);
      if (info.ModDate)      metadata.modificationDate = this.parseDate(info.ModDate);
      if (numPages) metadata.pages = numPages;

      if (content) metadata.wordCount = content.split(/\s+/).filter((w: string) => w.length > 0).length;

      return { content, metadata };
    } catch (error) {
      // Re-throw if already typed — prevents double-wrapping by future nested calls
      if (error instanceof ParseError) throw error;
      throw new ParseError(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`, { cause: error });
    }
  }

  private parseDate(dateStr: string): Date | undefined {
    try {
      // PDF dates are in format: D:YYYYMMDDHHmmSSOHH'mm or D:YYYYMMDDHHMMSS
      if (dateStr.startsWith('D:')) {
        const datepart = dateStr.slice(2, 16); // YYYYMMDDHHMMSS
        const year = parseInt(datepart.slice(0, 4));
        const month = parseInt(datepart.slice(4, 6)) - 1; // Month is 0-based
        const day = parseInt(datepart.slice(6, 8));
        const hour = parseInt(datepart.slice(8, 10) || '0');
        const minute = parseInt(datepart.slice(10, 12) || '0');
        const second = parseInt(datepart.slice(12, 14) || '0');

        return new Date(year, month, day, hour, minute, second);
      }
      return new Date(dateStr);
    } catch {
      return undefined;
    }
  }
}
