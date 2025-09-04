import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import { DocumentParser } from '../types/index.js';

export class WordParser implements DocumentParser {
  supports(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.docx' || ext === '.doc';
  }

  async parse(filePath: string): Promise<string> {
    try {
      const buffer = fs.readFileSync(filePath);
      const result = await mammoth.extractRawText({ buffer });
      return result.value.trim();
    } catch (error) {
      throw new Error(`Failed to parse Word document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}