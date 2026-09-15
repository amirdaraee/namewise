import { describe, it, expect } from 'vitest';
import { parseDocumentDate } from '../../../src/utils/document-date.js';

describe('parseDocumentDate()', () => {
  it('accepts a well-formed ISO date', () => {
    const d = parseDocumentDate('2024-03-15');
    expect(d).toBeInstanceOf(Date);
    // local components, so formatDate's local getters round-trip correctly
    expect(d!.getFullYear()).toBe(2024);
    expect(d!.getMonth()).toBe(2);
    expect(d!.getDate()).toBe(15);
  });

  it('trims surrounding whitespace', () => {
    expect(parseDocumentDate('  2024-03-15 ')).toBeInstanceOf(Date);
  });

  it('accepts a near-future date, for contracts and due dates', () => {
    const soon = new Date();
    soon.setMonth(soon.getMonth() + 2);
    const iso = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, '0')}-${String(soon.getDate()).padStart(2, '0')}`;
    expect(parseDocumentDate(iso)).toBeInstanceOf(Date);
  });

  it('returns undefined for no input', () => {
    expect(parseDocumentDate(undefined)).toBeUndefined();
    expect(parseDocumentDate('')).toBeUndefined();
  });

  it('rejects non-ISO spellings rather than guessing day/month order', () => {
    expect(parseDocumentDate('15/03/2024')).toBeUndefined();
    expect(parseDocumentDate('March 15, 2024')).toBeUndefined();
    expect(parseDocumentDate('last Tuesday')).toBeUndefined();
  });

  it('rejects a shape-valid date that is not a real calendar date', () => {
    expect(parseDocumentDate('2024-02-31')).toBeUndefined();
    expect(parseDocumentDate('2024-13-01')).toBeUndefined();
  });

  it('rejects dates outside the sane window', () => {
    expect(parseDocumentDate('1887-01-01')).toBeUndefined();
    expect(parseDocumentDate('2087-04-02')).toBeUndefined();
  });

  it('is inclusive at the lower bound', () => {
    expect(parseDocumentDate('1900-01-01')).toBeInstanceOf(Date);
  });

  it('is inclusive at the upper bound', () => {
    const now = new Date();
    const iso = `${now.getFullYear() + 1}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(parseDocumentDate(iso)).toBeInstanceOf(Date);
  });
});
