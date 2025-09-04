import fs from 'fs';
import path from 'path';
import { DocumentParser } from '../types/index.js';

export class TextParser implements DocumentParser {
  supports(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.txt' || ext === '.md' || ext === '.rtf';
  }

  async parse(filePath: string): Promise<string> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return content.trim();
    } catch (error) {
      throw new Error(`Failed to parse text file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}