import { describe, it, expect } from 'vitest';
import {
  NamewiseError, AuthError, NetworkError, RateLimitError,
  ParseError, FileSizeError, UnsupportedTypeError, ConfigError, VisionError
} from '../../src/errors.js';

describe('NamewiseError base', () => {
  it('sets name, message, hint, details, and cause', () => {
    const cause = new Error('original');
    const err = new AuthError('bad key', { hint: 'custom hint', details: { k: 'v' }, cause });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(NamewiseError);
    expect(err).toBeInstanceOf(AuthError);
    expect(err.name).toBe('AuthError');
    expect(err.message).toBe('bad key');
    expect(err.hint).toBe('custom hint');
    expect(err.details).toEqual({ k: 'v' });
    expect((err as any).cause).toBe(cause);
  });

  it('has undefined hint and details when not provided', () => {
    const err = new NamewiseError('bare error');
    expect(err.hint).toBeUndefined();
    expect(err.details).toBeUndefined();
    expect(err.name).toBe('NamewiseError');
  });

  it('custom hint overrides the default on any subclass', () => {
    const err = new FileSizeError('too big', { hint: 'try a smaller file' });
    expect(err.hint).toBe('try a smaller file');
  });
});

describe('default hints', () => {
  it('AuthError has default hint mentioning config set apiKey', () => {
    expect(new AuthError('x').hint).toMatch(/config set apiKey/);
  });
  it('NetworkError has default hint mentioning internet or ollama', () => {
    expect(new NetworkError('x').hint).toMatch(/ollama/i);
  });
  it('RateLimitError has default hint mentioning rate limit', () => {
    expect(new RateLimitError('x').hint).toMatch(/rate limit/i);
  });
  it('ParseError has default hint mentioning corrupt or unsupported', () => {
    expect(new ParseError('x').hint).toMatch(/corrupt|unsupported/i);
  });
  it('FileSizeError has default hint mentioning --max-size', () => {
    expect(new FileSizeError('x').hint).toMatch(/--max-size/);
  });
  it('UnsupportedTypeError has default hint mentioning namewise info', () => {
    expect(new UnsupportedTypeError('x').hint).toMatch(/namewise info/);
  });
  it('ConfigError has default hint mentioning config list', () => {
    expect(new ConfigError('x').hint).toMatch(/config list/);
  });
  it('VisionError has default hint mentioning --provider claude', () => {
    expect(new VisionError('x').hint).toMatch(/--provider claude/);
  });
});

describe('name property', () => {
  const cases: Array<[new (m: string) => NamewiseError, string]> = [
    [AuthError, 'AuthError'],
    [NetworkError, 'NetworkError'],
    [RateLimitError, 'RateLimitError'],
    [ParseError, 'ParseError'],
    [FileSizeError, 'FileSizeError'],
    [UnsupportedTypeError, 'UnsupportedTypeError'],
    [ConfigError, 'ConfigError'],
    [VisionError, 'VisionError'],
  ];
  for (const [Cls, name] of cases) {
    it(`${name}.name === '${name}'`, () => {
      expect(new Cls('msg').name).toBe(name);
    });
  }
});
