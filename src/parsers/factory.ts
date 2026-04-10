import { DocumentParser, Config } from '../types/index.js';
import { PDFParser } from './pdf-parser.js';
import { WordParser } from './word-parser.js';
import { ExcelParser } from './excel-parser.js';
import { TextParser } from './text-parser.js';
import { ImageParser } from './image-parser.js';

export class DocumentParserFactory {
  private parsers: DocumentParser[];

  constructor(config?: Config) {
    this.parsers = [
      new PDFParser(),
      new WordParser(),
      new ExcelParser(),
      new TextParser(),
      new ImageParser()
    ];
  }

  getParser(filePath: string): DocumentParser | null {
    return this.parsers.find(parser => parser.supports(filePath)) || null;
  }

  getSupportedExtensions(): string[] {
    const candidates = [
      '.pdf', '.docx', '.doc', '.xlsx', '.xls', '.txt', '.md', '.rtf',
      '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.heic', '.webp'
    ];
    return candidates.filter(ext =>
      this.parsers.some(parser => parser.supports(`file${ext}`))
    );
  }
}
