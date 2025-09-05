import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import { DocumentParser, ParseResult, DocumentMetadata } from '../types/index.js';

export class WordParser implements DocumentParser {
  supports(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.docx' || ext === '.doc';
  }

  async parse(filePath: string): Promise<ParseResult> {
    try {
      const buffer = fs.readFileSync(filePath);
      
      // Extract text content
      const textResult = await mammoth.extractRawText({ buffer });
      const content = textResult.value.trim();
      
      // Extract metadata
      const metadata: DocumentMetadata = {};
      
      // Estimate word count
      if (content) {
        metadata.wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
      }
      
      // Try to extract document properties for .docx files
      if (path.extname(filePath).toLowerCase() === '.docx') {
        try {
          // For DOCX files, we could parse document.xml for metadata
          // For now, we'll use basic analysis of the content
          const lines = content.split('\n');
          const firstNonEmptyLine = lines.find(line => line.trim().length > 0);
          
          // If the first line looks like a title (short and not a sentence)
          if (firstNonEmptyLine && firstNonEmptyLine.length < 100 && !firstNonEmptyLine.endsWith('.')) {
            metadata.title = firstNonEmptyLine.trim();
          }
        } catch {
          // Ignore metadata extraction errors
        }
      }
      
      return { content, metadata };
    } catch (error) {
      throw new Error(`Failed to parse Word document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}