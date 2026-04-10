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
      const parser1 = factory.getParser('test.mp4');
      const parser2 = factory.getParser('test.zip');
      const parser3 = factory.getParser('test.exe');

      expect(parser1).toBeNull();
      expect(parser2).toBeNull();
      expect(parser3).toBeNull();
    });

    it('should return ImageParser for JPEG files', () => {
      const parser = factory.getParser('photo.jpg');
      expect(parser).toBeDefined();
      expect(parser?.supports('photo.jpg')).toBe(true);
    });

    it('should return ImageParser for all image extensions', () => {
      const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.heic', '.webp'];
      for (const ext of imageExts) {
        const parser = factory.getParser(`file${ext}`);
        expect(parser).toBeDefined();
        expect(parser?.supports(`file${ext}`)).toBe(true);
      }
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

    it('should include at least 16 extensions (8 document + 8 image)', () => {
      const extensions = factory.getSupportedExtensions();
      expect(extensions.length).toBeGreaterThanOrEqual(16);
    });

    it('should only list extensions that at least one parser actually supports', () => {
      const extensions = factory.getSupportedExtensions();
      extensions.forEach(ext => {
        expect(factory.getParser(`file${ext}`)).not.toBeNull();
      });
    });

    it('should not include non-image, non-document extensions', () => {
      const extensions = factory.getSupportedExtensions();
      expect(extensions).not.toContain('.mp4');
      expect(extensions).not.toContain('.zip');
      expect(extensions).not.toContain('.exe');
    });

    it('should include all 8 image extensions', () => {
      const extensions = factory.getSupportedExtensions();
      expect(extensions).toContain('.jpg');
      expect(extensions).toContain('.jpeg');
      expect(extensions).toContain('.png');
      expect(extensions).toContain('.gif');
      expect(extensions).toContain('.bmp');
      expect(extensions).toContain('.tiff');
      expect(extensions).toContain('.heic');
      expect(extensions).toContain('.webp');
    });
  });
});