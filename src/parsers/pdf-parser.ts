import fs from 'fs';
import path from 'path';
import { DocumentParser, ParseResult, DocumentMetadata } from '../types/index.js';

export class PDFParser implements DocumentParser {
  supports(filePath: string): boolean {
    return path.extname(filePath).toLowerCase() === '.pdf';
  }

  async parse(filePath: string): Promise<ParseResult> {
    try {
      // Dynamic import for pdf-extraction (default export)
      const pdfExtraction = await import('pdf-extraction');
      const extract = pdfExtraction.default;
      
      const dataBuffer = fs.readFileSync(filePath);
      const data = await extract(dataBuffer, {});
      
      const content = data.text?.trim() || '';
      
      // Extract PDF metadata if available
      const metadata: DocumentMetadata = {};
      
      // Cast data to any to access potentially existing metadata properties
      const pdfData = data as any;
      
      if (pdfData.meta) {
        if (pdfData.meta.info) {
          metadata.title = pdfData.meta.info.Title;
          metadata.author = pdfData.meta.info.Author;
          metadata.creator = pdfData.meta.info.Creator;
          metadata.subject = pdfData.meta.info.Subject;
          
          // Parse dates if available
          if (pdfData.meta.info.CreationDate) {
            metadata.creationDate = this.parseDate(pdfData.meta.info.CreationDate);
          }
          if (pdfData.meta.info.ModDate) {
            metadata.modificationDate = this.parseDate(pdfData.meta.info.ModDate);
          }
        }
        
        if (pdfData.numpages) {
          metadata.pages = pdfData.numpages;
        }
      }
      
      // Estimate word count from text content
      if (content) {
        metadata.wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
      }
      
      return { content, metadata };
    } catch (error) {
      throw new Error(`Failed to parse PDF file: ${error instanceof Error ? error.message : 'Unknown error'}`);
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