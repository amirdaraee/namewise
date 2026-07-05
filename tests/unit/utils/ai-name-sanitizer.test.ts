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

  it('truncates long kebab-case names at a word boundary', () => {
    const longName = Array.from({ length: 30 }, (_, i) => `segment${i}`).join(' ');
    const result = sanitizeCloudFileName(longName, 'kebab-case');
    expect(result.length).toBeLessThanOrEqual(100);
    expect(result).toMatch(/segment\d+$/);
    expect(result.endsWith('-')).toBe(false);
  });

  it('truncates long snake_case names at a word boundary', () => {
    const longName = Array.from({ length: 30 }, (_, i) => `segment${i}`).join(' ');
    const result = sanitizeCloudFileName(longName, 'snake_case');
    expect(result.length).toBeLessThanOrEqual(100);
    expect(result).toMatch(/segment\d+$/);
    expect(result.endsWith('_')).toBe(false);
  });

  it('hard-truncates long names for conventions without separators', () => {
    const longName = Array.from({ length: 30 }, (_, i) => `segment${i}`).join(' ');
    const result = sanitizeCloudFileName(longName, 'camelCase');
    expect(result.length).toBe(100);
  });

  it('leaves short names below the limit untouched', () => {
    expect(sanitizeCloudFileName('short name', 'snake_case')).toBe('short_name');
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
});
