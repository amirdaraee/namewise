import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs so we can control what readFileSync returns/throws
vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn()
  }
}));

import fs from 'fs';
import { TextParser } from '../../../src/parsers/text-parser.js';
import { ParseError } from '../../../src/errors.js';

describe('TextParser (mocked)', () => {
  let parser: TextParser;

  beforeEach(() => {
    vi.clearAllMocks();
    parser = new TextParser();
  });

  describe('parse() title extraction branches', () => {
    it('should not set a title for markdown files without a leading heading', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue('No heading here\nJust body text.');

      const result = await parser.parse('/path/to/notes.md');

      expect(result.metadata.title).toBeUndefined();
      expect(result.metadata.wordCount).toBeGreaterThan(0);
    });

    it('should not set a title when the first line is 100 characters or longer', async () => {
      const longLine = 'a'.repeat(100);
      vi.mocked(fs.readFileSync).mockReturnValue(`${longLine}\nBody text.`);

      const result = await parser.parse('/path/to/file.txt');

      expect(result.metadata.title).toBeUndefined();
    });

    it('should not set a title when the first line ends with a period', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue('This is a full sentence.\nMore body text.');

      const result = await parser.parse('/path/to/file.txt');

      expect(result.metadata.title).toBeUndefined();
    });
  });

  describe('parse() error handling', () => {
    it('should re-throw typed ParseError without double-wrapping', async () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new ParseError('typed text error');
      });

      await expect(parser.parse('/path/to/file.txt')).rejects.toBeInstanceOf(ParseError);
      await expect(parser.parse('/path/to/file.txt')).rejects.toThrow(/^typed text error$/);
    });

    it('should include "Unknown error" when a non-Error is thrown', async () => {
      // Throw a plain string (not an Error instance) to exercise the
      // `error instanceof Error ? ... : 'Unknown error'` false branch (line 40)
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw 'plain string error';
      });

      await expect(parser.parse('/path/to/file.txt')).rejects.toThrow(
        'Failed to parse text file: Unknown error'
      );
    });
  });
});
