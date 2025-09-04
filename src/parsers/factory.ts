import { DocumentParser } from '../types/index.js';
import { PDFParser } from './pdf-parser.js';
import { WordParser } from './word-parser.js';
import { ExcelParser } from './excel-parser.js';
import { TextParser } from './text-parser.js';

export class DocumentParserFactory {
  private parsers: DocumentParser[] = [
    new PDFParser(),
    new WordParser(),
    new ExcelParser(),
    new TextParser()
  ];

  getParser(filePath: string): DocumentParser | null {
    return this.parsers.find(parser => parser.supports(filePath)) || null;
  }

  getSupportedExtensions(): string[] {
    const extensions = new Set<string>();
    
    // Add known extensions based on parser implementations
    extensions.add('.pdf');
    extensions.add('.docx');
    extensions.add('.doc');
    extensions.add('.xlsx');
    extensions.add('.xls');
    extensions.add('.txt');
    extensions.add('.md');
    extensions.add('.rtf');
    
    return Array.from(extensions);
  }
}