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
      const pdfExtraction = await import('pdf-extraction');
      const extract = pdfExtraction.default;

      const dataBuffer = fs.readFileSync(filePath);

      // Suppress pdfjs noise (both stderr and console.warn) for the entire PDF
      // pipeline — the "TT: undefined function" warning can come from either
      // pdf-extraction (text path) or pdf-to-png-converter (scanned path).
      const origStderrWrite = (process.stderr as any).write?.bind(process.stderr);
      const origConsoleWarn = console.warn;
      (process.stderr as any).write = () => true;
      console.warn = () => {};

      let data: any;
      let content = '';

      try {
        data = await extract(dataBuffer, {});
        content = data.text?.trim() || '';

        if (PDFToImageConverter.isScannedPDF(content)) {
          try {
            const imageBase64 = await PDFToImageConverter.convertFirstPageToBase64(dataBuffer);
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
      const pdfData = data as any;

      if (pdfData.meta) {
        if (pdfData.meta.info) {
          metadata.title    = pdfData.meta.info.Title;
          metadata.author   = pdfData.meta.info.Author;
          metadata.creator  = pdfData.meta.info.Creator;
          metadata.subject  = pdfData.meta.info.Subject;
          if (pdfData.meta.info.CreationDate) metadata.creationDate = this.parseDate(pdfData.meta.info.CreationDate);
          if (pdfData.meta.info.ModDate)      metadata.modificationDate = this.parseDate(pdfData.meta.info.ModDate);
        }
        if (pdfData.numpages) metadata.pages = pdfData.numpages;
      }

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