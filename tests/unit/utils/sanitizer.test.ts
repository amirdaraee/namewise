import { describe, it, expect } from 'vitest';
import { sanitizeFilename } from '../../../src/utils/sanitizer.js';

describe('sanitizeFilename()', () => {
  it('returns clean name unchanged', () => {
    expect(sanitizeFilename('meeting-notes', 'kebab-case')).toBe('meeting-notes');
  });

  it('strips Windows-illegal characters', () => {
    expect(sanitizeFilename('report<2024>final', 'kebab-case')).toBe('report-2024-final');
  });

  it('strips control characters', () => {
    expect(sanitizeFilename('file\x00name', 'kebab-case')).toBe('filename');
  });

  it('normalizes unicode to NFC', () => {
    const decomposed = 'e\u0301';
    const precomposed = '\u00e9';
    expect(sanitizeFilename(decomposed, 'kebab-case')).toBe(sanitizeFilename(precomposed, 'kebab-case'));
  });

  it('applies kebab-case convention', () => {
    expect(sanitizeFilename('My Report 2024', 'kebab-case')).toBe('my-report-2024');
  });

  it('applies snake_case convention', () => {
    expect(sanitizeFilename('My Report 2024', 'snake_case')).toBe('my_report_2024');
  });

  it('trims result to 200 characters', () => {
    const long = 'a'.repeat(300);
    expect(sanitizeFilename(long, 'kebab-case').length).toBeLessThanOrEqual(200);
  });

  it('defaults to kebab-case when no convention specified', () => {
    expect(sanitizeFilename('My File')).toBe('my-file');
  });
});
