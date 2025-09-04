import fs from 'fs';
import path from 'path';
import { DocumentParser } from '../types/index.js';

export class PDFParser implements DocumentParser {
  supports(filePath: string): boolean {
    return path.extname(filePath).toLowerCase() === '.pdf';
  }

  async parse(filePath: string): Promise<string> {
    try {
      // Dynamic import for pdf-extraction (default export)
      const pdfExtraction = await import('pdf-extraction');
      const extract = pdfExtraction.default;
      
      const dataBuffer = fs.readFileSync(filePath);
      const data = await extract(dataBuffer, {});
      
      return data.text?.trim() || '';
    } catch (error) {
      throw new Error(`Failed to parse PDF file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}