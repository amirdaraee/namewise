import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentParserFactory } from '../../../src/parsers/factory.js';

describe('DocumentParserFactory', () => {
  let factory: DocumentParserFactory;

  beforeEach(() => {
    factory = new DocumentParserFactory();
  });

  describe('getParser()', () => {
    it('should return PDFParser for PDF files', () => {
      const parser = factory.getParser('test.pdf');
      expect(parser).toBeDefined();
      expect(parser?.supports('test.pdf')).toBe(true);
    });

    it('should return WordParser for Word documents', () => {
      const parser1 = factory.getParser('test.docx');
      const parser2 = factory.getParser('test.doc');
      
      expect(parser1).toBeDefined();
      expect(parser2).toBeDefined();
      expect(parser1?.supports('test.docx')).toBe(true);
      expect(parser2?.supports('test.doc')).toBe(true);
    });

    it('should return ExcelParser for Excel files', () => {
      const parser1 = factory.getParser('test.xlsx');
      const parser2 = factory.getParser('test.xls');
      
      expect(parser1).toBeDefined();
      expect(parser2).toBeDefined();
      expect(parser1?.supports('test.xlsx')).toBe(true);
      expect(parser2?.supports('test.xls')).toBe(true);
    });

    it('should return TextParser for text files', () => {
      const parser1 = factory.getParser('test.txt');
      const parser2 = factory.getParser('test.md');
      const parser3 = factory.getParser('test.rtf');
      
      expect(parser1).toBeDefined();
      expect(parser2).toBeDefined();
      expect(parser3).toBeDefined();
      expect(parser1?.supports('test.txt')).toBe(true);
      expect(parser2?.supports('test.md')).toBe(true);
      expect(parser3?.supports('test.rtf')).toBe(true);
    });

    it('should return null for unsupported file types', () => {
      const parser1 = factory.getParser('test.png');
      const parser2 = factory.getParser('test.jpg');
      const parser3 = factory.getParser('test.mp4');
      const parser4 = factory.getParser('test.zip');
      
      expect(parser1).toBeNull();
      expect(parser2).toBeNull();
      expect(parser3).toBeNull();
      expect(parser4).toBeNull();
    });

    it('should be case insensitive', () => {
      const parser1 = factory.getParser('test.PDF');
      const parser2 = factory.getParser('test.DOCX');
      const parser3 = factory.getParser('test.TXT');
      
      expect(parser1).toBeDefined();
      expect(parser2).toBeDefined();
      expect(parser3).toBeDefined();
    });
  });

  describe('getSupportedExtensions()', () => {
    it('should return all supported extensions', () => {
      const extensions = factory.getSupportedExtensions();
      
      expect(extensions).toContain('.pdf');
      expect(extensions).toContain('.docx');
      expect(extensions).toContain('.doc');
      expect(extensions).toContain('.xlsx');
      expect(extensions).toContain('.xls');
      expect(extensions).toContain('.txt');
      expect(extensions).toContain('.md');
      expect(extensions).toContain('.rtf');
    });

    it('should return unique extensions', () => {
      const extensions = factory.getSupportedExtensions();
      const uniqueExtensions = [...new Set(extensions)];
      
      expect(extensions.length).toBe(uniqueExtensions.length);
    });

    it('should include at least 8 extensions', () => {
      const extensions = factory.getSupportedExtensions();
      expect(extensions.length).toBeGreaterThanOrEqual(8);
    });
  });
});