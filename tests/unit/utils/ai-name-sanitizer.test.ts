import { describe, it, expect } from 'vitest';
import { sanitizeCloudFileName, sanitizeLocalFileName } from '../../../src/utils/ai-name-sanitizer.js';

describe('sanitizeCloudFileName', () => {
  it('strips the extension and applies the naming convention', () => {
    expect(sanitizeCloudFileName('Meeting Notes Q4.pdf', 'kebab-case')).toBe('meeting-notes-q4');
  });

  it('strips Windows-illegal characters', () => {
    expect(sanitizeCloudFileName('report<draft>:v2.pdf', 'kebab-case')).not.toMatch(/[<>:"/\\|?*]/);
  });

  it('falls back to untitled document when the name sanitizes to nothing', () => {
    expect(sanitizeCloudFileName('<>:"|?*.pdf', 'kebab-case')).toBe('untitled-document');
  });

  // ≤12 words (passes the prose guard) but >100 chars — exercises truncation
  const longWordName = Array.from({ length: 10 }, (_, i) => `verylongsegment${i}`).join(' ');

  it('truncates long kebab-case names at a word boundary', () => {
    const result = sanitizeCloudFileName(longWordName, 'kebab-case');
    expect(result.length).toBeLessThanOrEqual(100);
    expect(result).toMatch(/segment\d+$/);
    expect(result.endsWith('-')).toBe(false);
  });

  it('truncates long snake_case names at a word boundary', () => {
    const result = sanitizeCloudFileName(longWordName, 'snake_case');
    expect(result.length).toBeLessThanOrEqual(100);
    expect(result).toMatch(/segment\d+$/);
    expect(result.endsWith('_')).toBe(false);
  });

  it('hard-truncates long names for conventions without separators', () => {
    const result = sanitizeCloudFileName(longWordName, 'camelCase');
    expect(result.length).toBe(100);
  });

  it('leaves short names below the limit untouched', () => {
    expect(sanitizeCloudFileName('short name', 'snake_case')).toBe('short_name');
  });

  it('rejects prose explanations by word count', () => {
    const prose = Array.from({ length: 20 }, (_, i) => `word${i}`).join('-');
    expect(() => sanitizeCloudFileName(prose, 'kebab-case'))
      .toThrow(/explanation instead of a filename/);
  });

  it('rejects prose explanations by telltale prefix even when short', () => {
    expect(() => sanitizeCloudFileName('based-on-the-document-content-scanned', 'kebab-case'))
      .toThrow(/explanation instead of a filename/);
    expect(() => sanitizeCloudFileName('sorry I cannot read this', 'kebab-case'))
      .toThrow(/explanation instead of a filename/);
  });

  it('accepts a name at exactly the 12-word limit', () => {
    const name = Array.from({ length: 12 }, (_, i) => `w${i}`).join(' ');
    expect(() => sanitizeCloudFileName(name, 'kebab-case')).not.toThrow();
  });
});

describe('sanitizeLocalFileName', () => {
  it('removes surrounding quotes and known extensions', () => {
    expect(sanitizeLocalFileName('"Project Report.docx"')).toBe('project-report');
    expect(sanitizeLocalFileName("'notes.md'")).toBe('notes');
  });

  it('replaces invalid characters and whitespace with hyphens', () => {
    const result = sanitizeLocalFileName('my file<with>bad:chars');
    expect(result).not.toMatch(/[<>:"/\\|?*\s]/);
    expect(result).toContain('-');
  });

  it('lowercases the result', () => {
    expect(sanitizeLocalFileName('UPPER Case Name')).toBe('upper-case-name');
  });

  it('rejects prose explanations like cloud sanitizer does', () => {
    expect(() => sanitizeLocalFileName('Here is a descriptive filename for this document based on its content and purpose'))
      .toThrow(/explanation instead of a filename/);
  });
});
