import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock mammoth - factory function cannot reference top-level variables (hoisting)
vi.mock('mammoth', () => ({
  default: {
    extractRawText: vi.fn()
  }
}));

// Mock fs - factory function cannot reference top-level variables (hoisting)
vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn().mockReturnValue(Buffer.from('fake docx content'))
  }
}));

import mammoth from 'mammoth';
import fs from 'fs';
import { WordParser } from '../../../src/parsers/word-parser.js';

describe('WordParser', () => {
  let parser: WordParser;
  const mockExtractRawText = vi.mocked(mammoth.extractRawText);
  const mockReadFileSync = vi.mocked(fs.readFileSync);

  beforeEach(() => {
    vi.clearAllMocks();
    parser = new WordParser();
    mockReadFileSync.mockReturnValue(Buffer.from('fake docx content'));
    mockExtractRawText.mockResolvedValue({ value: 'Document content here' } as any);
  });

  describe('supports()', () => {
    it('should return true for .docx files', () => {
      expect(parser.supports('/path/to/file.docx')).toBe(true);
    });

    it('should return true for .doc files', () => {
      expect(parser.supports('/path/to/file.doc')).toBe(true);
    });

    it('should return true for uppercase extensions', () => {
      expect(parser.supports('/path/to/file.DOCX')).toBe(true);
      expect(parser.supports('/path/to/file.DOC')).toBe(true);
    });

    it('should return false for .pdf files', () => {
      expect(parser.supports('/path/to/file.pdf')).toBe(false);
    });

    it('should return false for .txt files', () => {
      expect(parser.supports('/path/to/file.txt')).toBe(false);
    });

    it('should return false for .xlsx files', () => {
      expect(parser.supports('/path/to/file.xlsx')).toBe(false);
    });
  });

  describe('parse()', () => {
    it('should extract content and calculate word count', async () => {
      mockExtractRawText.mockResolvedValue({ value: 'This is a document with several words' } as any);

      const result = await parser.parse('/path/to/file.doc');

      expect(result.content).toBe('This is a document with several words');
      expect(result.metadata.wordCount).toBe(7);
    });

    it('should trim whitespace from extracted content', async () => {
      mockExtractRawText.mockResolvedValue({ value: '  \n  Content with spaces  \n  ' } as any);

      const result = await parser.parse('/path/to/file.doc');

      expect(result.content).toBe('Content with spaces');
    });

    it('should extract title from .docx when first line is short and has no period', async () => {
      mockExtractRawText.mockResolvedValue({
        value: 'My Document Title\nThis is the body content of the document. It has multiple sentences.'
      } as any);

      const result = await parser.parse('/path/to/file.docx');

      expect(result.metadata.title).toBe('My Document Title');
    });

    it('should NOT extract title when first non-empty line ends with period', async () => {
      mockExtractRawText.mockResolvedValue({
        value: 'This is a sentence.\nMore content here.'
      } as any);

      const result = await parser.parse('/path/to/file.docx');

      expect(result.metadata.title).toBeUndefined();
    });

    it('should NOT extract title when first non-empty line is >= 100 characters', async () => {
      const longLine = 'a'.repeat(100); // exactly 100 chars (condition is < 100)
      mockExtractRawText.mockResolvedValue({
        value: `${longLine}\nMore content.`
      } as any);

      const result = await parser.parse('/path/to/file.docx');

      expect(result.metadata.title).toBeUndefined();
    });

    it('should find first non-empty line for title when content starts with empty lines', async () => {
      mockExtractRawText.mockResolvedValue({
        value: '\n\nActual Title\nBody content.'
      } as any);

      const result = await parser.parse('/path/to/file.docx');

      expect(result.metadata.title).toBe('Actual Title');
    });

    it('should NOT extract title for .doc files (only .docx)', async () => {
      mockExtractRawText.mockResolvedValue({ value: 'Short Title\nMore content.' } as any);

      const result = await parser.parse('/path/to/file.doc');

      expect(result.metadata.title).toBeUndefined();
    });

    it('should handle empty content', async () => {
      mockExtractRawText.mockResolvedValue({ value: '' } as any);

      const result = await parser.parse('/path/to/file.docx');

      expect(result.content).toBe('');
      expect(result.metadata.wordCount).toBeUndefined();
    });

    it('should throw error when parsing fails', async () => {
      mockExtractRawText.mockRejectedValue(new Error('Cannot read file'));

      await expect(parser.parse('/path/to/file.docx')).rejects.toThrow(
        'Failed to parse Word document: Cannot read file'
      );
    });

    it('should silently swallow errors from the .docx inner metadata try/catch', async () => {
      // To trigger the inner catch (line 40-42), we need content.split('\n') to throw.
      // We achieve this by returning a fake "content" object whose split() throws on
      // the second call (the first call, split(/\s+/), must succeed for wordCount).
      const fakeContent: any = {
        split: vi.fn()
          .mockReturnValueOnce(['word1', 'word2']) // first split(/\s+/) for wordCount
          .mockImplementationOnce(() => { throw new Error('inner split error'); }), // second split('\n')
        trim: function () { return this; },
        length: 10
      };
      mockExtractRawText.mockResolvedValue({ value: { trim: () => fakeContent } } as any);

      // Should not throw — the inner catch silently swallows the error
      const result = await parser.parse('/path/to/file.docx');

      expect(result).toBeDefined();
      expect(result.metadata.title).toBeUndefined();
    });

    it('should throw error when readFileSync fails', async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      await expect(parser.parse('/nonexistent/file.docx')).rejects.toThrow(
        'Failed to parse Word document: File not found'
      );
    });

    it('should handle non-Error exception with unknown error message', async () => {
      mockExtractRawText.mockRejectedValue('string error');

      await expect(parser.parse('/path/to/file.docx')).rejects.toThrow(
        'Failed to parse Word document: Unknown error'
      );
    });
  });
});
