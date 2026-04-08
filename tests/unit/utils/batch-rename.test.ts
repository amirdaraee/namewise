import { describe, it, expect } from 'vitest';
import {
  applySequence,
  applyPrefix,
  applySuffix,
  applyDateStamp,
  applyStrip,
  applyTruncate
} from '../../../src/utils/batch-rename.js';

describe('applySequence()', () => {
  it('pads numbers with leading zeros based on total', () => {
    expect(applySequence(3, 100)).toBe('004');
  });
  it('uses minimum 3-digit padding', () => {
    expect(applySequence(0, 5)).toBe('001');
  });
  it('prepends prefix when provided', () => {
    expect(applySequence(0, 10, 'photo')).toBe('photo-001');
  });
  it('handles index at total boundary', () => {
    expect(applySequence(99, 100)).toBe('100');
  });
});

describe('applyPrefix()', () => {
  it('prepends string to stem', () => {
    expect(applyPrefix('report', '2024-')).toBe('2024-report');
  });
  it('handles empty prefix', () => {
    expect(applyPrefix('report', '')).toBe('report');
  });
});

describe('applySuffix()', () => {
  it('appends string to stem', () => {
    expect(applySuffix('report', '-final')).toBe('report-final');
  });
  it('handles empty suffix', () => {
    expect(applySuffix('report', '')).toBe('report');
  });
});

describe('applyDateStamp()', () => {
  const d = new Date('2024-03-15T00:00:00Z');
  it('prepends YYYY-MM-DD', () => {
    expect(applyDateStamp('report', d, 'YYYY-MM-DD')).toBe('2024-03-15-report');
  });
  it('prepends YYYYMMDD', () => {
    expect(applyDateStamp('report', d, 'YYYYMMDD')).toBe('20240315-report');
  });
  it('prepends YYYY', () => {
    expect(applyDateStamp('report', d, 'YYYY')).toBe('2024-report');
  });
  it('uses YYYY-MM-DD when format is "none"', () => {
    expect(applyDateStamp('report', d, 'none')).toBe('2024-03-15-report');
  });
});

describe('applyStrip()', () => {
  it('removes matching pattern from stem', () => {
    expect(applyStrip('Copy of report', 'Copy of ')).toBe('report');
  });
  it('removes all occurrences', () => {
    expect(applyStrip('aa_bb_aa_cc', 'aa_')).toBe('bb_cc');
  });
  it('returns stem unchanged when pattern not found', () => {
    expect(applyStrip('report', 'xyz')).toBe('report');
  });
});

describe('applyTruncate()', () => {
  it('truncates stem to maxLen', () => {
    expect(applyTruncate('longfilename', 4)).toBe('long');
  });
  it('leaves short stems unchanged', () => {
    expect(applyTruncate('hi', 10)).toBe('hi');
  });
  it('handles exact length match', () => {
    expect(applyTruncate('abc', 3)).toBe('abc');
  });
});
