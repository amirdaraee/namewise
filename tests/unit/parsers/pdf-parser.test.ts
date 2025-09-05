import { describe, it, expect, beforeEach } from 'vitest';
import { PDFParser } from '../../../src/parsers/pdf-parser.js';
import path from 'path';

describe('PDFParser', () => {
  let parser: PDFParser;
  const testDataDir = path.join(process.cwd(), 'tests/data');

  beforeEach(() => {
    parser = new PDFParser();
  });

  describe('supports()', () => {
    it('should support .pdf files', () => {
      expect(parser.supports('test.pdf')).toBe(true);
    });

    it('should not support other file types', () => {
      expect(parser.supports('test.txt')).toBe(false);
      expect(parser.supports('test.docx')).toBe(false);
      expect(parser.supports('test.xlsx')).toBe(false);
      expect(parser.supports('test.md')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(parser.supports('test.PDF')).toBe(true);
      expect(parser.supports('test.Pdf')).toBe(true);
    });
  });

  describe('parse()', () => {
    it('should parse PDF file content correctly', async () => {
      const filePath = path.join(testDataDir, 'sample-pdf.pdf');
      const result = await parser.parse(filePath);

      expect(result.content.length).toBeGreaterThan(0);
      expect(typeof result.content).toBe('string');
      expect(result.metadata).toBeDefined();
      // Check for some expected content from the test PDF
      expect(result.content.toLowerCase()).toMatch(/trace|type|specialization|dynamic|languages/);
    });

    it('should throw error for non-existent files', async () => {
      const filePath = path.join(testDataDir, 'non-existent.pdf');
      
      await expect(parser.parse(filePath)).rejects.toThrow('Failed to parse PDF file');
    });

    it('should throw error for invalid PDF files', async () => {
      const filePath = path.join(testDataDir, 'sample-text.txt'); // Not a PDF
      
      await expect(parser.parse(filePath)).rejects.toThrow('Failed to parse PDF file');
    });

    it('should trim whitespace from extracted content', async () => {
      const filePath = path.join(testDataDir, 'sample-pdf.pdf');
      const result = await parser.parse(filePath);

      expect(result.content).not.toMatch(/^\s/);
      expect(result.content).not.toMatch(/\s$/);
    });
  });
});