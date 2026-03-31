import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs so we can control what readFileSync returns/throws
vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn()
  }
}));

import fs from 'fs';
import { TextParser } from '../../../src/parsers/text-parser.js';

describe('TextParser (mocked)', () => {
  let parser: TextParser;

  beforeEach(() => {
    vi.clearAllMocks();
    parser = new TextParser();
  });

  describe('parse() error handling', () => {
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
