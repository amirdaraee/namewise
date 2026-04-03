import { describe, it, expect } from 'vitest';
import { parsePattern, applyPatterns } from '../../../src/utils/pattern-rename.js';

describe('parsePattern()', () => {
  it('parses sed-style s/find/replace/flags', () => {
    const { find, replace } = parsePattern('s/foo/bar/g');
    expect('foobar foo'.replace(find, replace)).toBe('barbar bar');
  });

  it('parses sed-style without flags', () => {
    const { find, replace } = parsePattern('s/hello/world/');
    expect('hello world'.replace(find, replace)).toBe('world world');
  });

  it('parses find:replace simple format', () => {
    const { find, replace } = parsePattern('foo:bar');
    expect('foo baz'.replace(find, replace)).toBe('bar baz');
  });

  it('throws on invalid pattern format', () => {
    expect(() => parsePattern('not-valid')).toThrow('Invalid pattern format');
  });
});

describe('applyPatterns()', () => {
  it('applies a single pattern to the stem', () => {
    expect(applyPatterns('my-old-report', ['s/old/new/'])).toBe('my-new-report');
  });

  it('chains multiple patterns in order', () => {
    expect(applyPatterns('report-2023-draft', ['s/2023/2024/', 's/-draft//'])).toBe('report-2024');
  });

  it('returns stem unchanged when no patterns match', () => {
    expect(applyPatterns('clean-name', ['s/xyz/abc/'])).toBe('clean-name');
  });
});
