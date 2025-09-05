import { describe, it, expect, beforeEach } from 'vitest';
import { TextParser } from '../../../src/parsers/text-parser.js';
import path from 'path';

describe('TextParser', () => {
  let parser: TextParser;
  const testDataDir = path.join(process.cwd(), 'tests/data');

  beforeEach(() => {
    parser = new TextParser();
  });

  describe('supports()', () => {
    it('should support .txt files', () => {
      expect(parser.supports('test.txt')).toBe(true);
    });

    it('should support .md files', () => {
      expect(parser.supports('test.md')).toBe(true);
    });

    it('should support .rtf files', () => {
      expect(parser.supports('test.rtf')).toBe(true);
    });

    it('should not support other file types', () => {
      expect(parser.supports('test.pdf')).toBe(false);
      expect(parser.supports('test.docx')).toBe(false);
      expect(parser.supports('test.xlsx')).toBe(false);
      expect(parser.supports('test.png')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(parser.supports('test.TXT')).toBe(true);
      expect(parser.supports('test.MD')).toBe(true);
      expect(parser.supports('test.RTF')).toBe(true);
    });
  });

  describe('parse()', () => {
    it('should parse text file content correctly', async () => {
      const filePath = path.join(testDataDir, 'sample-text.txt');
      const result = await parser.parse(filePath);

      expect(result.content).toContain('Project Requirements Document');
      expect(result.content).toContain('customer management system');
      expect(result.content).toContain('React.js');
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.metadata).toBeDefined();
    });

    it('should parse markdown file content correctly', async () => {
      const filePath = path.join(testDataDir, 'sample-markdown.md');
      const result = await parser.parse(filePath);

      expect(result.content).toContain('Meeting Notes');
      expect(result.content).toContain('Action Items');
      expect(result.content).toContain('John, Sarah, Mike');
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.metadata).toBeDefined();
    });

    it('should handle empty files', async () => {
      const filePath = path.join(testDataDir, 'empty-file.txt');
      const result = await parser.parse(filePath);

      expect(result.content).toBe('');
      expect(result.metadata).toBeDefined();
    });

    it('should throw error for non-existent files', async () => {
      const filePath = path.join(testDataDir, 'non-existent.txt');
      
      await expect(parser.parse(filePath)).rejects.toThrow('Failed to parse text file');
    });

    it('should trim whitespace from content', async () => {
      const filePath = path.join(testDataDir, 'sample-text.txt');
      const result = await parser.parse(filePath);

      expect(result.content).not.toMatch(/^\s/);
      expect(result.content).not.toMatch(/\s$/);
    });
  });
});