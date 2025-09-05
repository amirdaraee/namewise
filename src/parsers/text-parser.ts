import fs from 'fs';
import path from 'path';
import { DocumentParser, ParseResult, DocumentMetadata } from '../types/index.js';

export class TextParser implements DocumentParser {
  supports(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.txt' || ext === '.md' || ext === '.rtf';
  }

  async parse(filePath: string): Promise<ParseResult> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8').trim();
      const metadata: DocumentMetadata = {};
      
      // Extract basic metadata from content
      const lines = content.split('\n').filter(line => line.trim());
      
      if (lines.length > 0) {
        // For markdown files, look for title in first heading
        if (path.extname(filePath).toLowerCase() === '.md') {
          const firstLine = lines[0];
          if (firstLine.startsWith('# ')) {
            metadata.title = firstLine.substring(2).trim();
          }
        } else {
          // For other text files, use first non-empty line as potential title
          const firstNonEmptyLine = lines[0];
          if (firstNonEmptyLine.length < 100 && !firstNonEmptyLine.endsWith('.')) {
            metadata.title = firstNonEmptyLine.trim();
          }
        }
        
        // Word count
        metadata.wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
      }

      return { content, metadata };
    } catch (error) {
      throw new Error(`Failed to parse text file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}