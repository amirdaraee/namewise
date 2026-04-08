import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      ...(actual as any).promises,
      readdir: vi.fn(),
      stat: vi.fn()
    }
  };
});

import { promises as fs } from 'fs';
import { collectFiles, formatBytes } from '../../../src/utils/fs-collect.js';

beforeEach(() => vi.clearAllMocks());

describe('collectFiles()', () => {
  it('returns files in a flat directory', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: 'a.txt', isDirectory: () => false, isFile: () => true } as any,
      { name: 'b.pdf', isDirectory: () => false, isFile: () => true } as any
    ]);
    const result = await collectFiles('/dir');
    expect(result).toEqual(['/dir/a.txt', '/dir/b.pdf']);
  });

  it('does not recurse when recursive=false', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: 'sub', isDirectory: () => true, isFile: () => false } as any,
      { name: 'a.txt', isDirectory: () => false, isFile: () => true } as any
    ]);
    const result = await collectFiles('/dir', { recursive: false });
    expect(result).toEqual(['/dir/a.txt']);
  });

  it('recurses into subdirectories when recursive=true', async () => {
    vi.mocked(fs.readdir)
      .mockResolvedValueOnce([
        { name: 'sub', isDirectory: () => true, isFile: () => false } as any,
        { name: 'a.txt', isDirectory: () => false, isFile: () => true } as any
      ])
      .mockResolvedValueOnce([
        { name: 'b.txt', isDirectory: () => false, isFile: () => true } as any
      ]);
    const result = await collectFiles('/dir', { recursive: true });
    expect(result).toEqual(['/dir/sub/b.txt', '/dir/a.txt']);
  });

  it('respects maxDepth', async () => {
    vi.mocked(fs.readdir)
      .mockResolvedValueOnce([
        { name: 'sub', isDirectory: () => true, isFile: () => false } as any
      ])
      .mockResolvedValueOnce([
        { name: 'deep', isDirectory: () => true, isFile: () => false } as any,
        { name: 'c.txt', isDirectory: () => false, isFile: () => true } as any
      ]);
    const result = await collectFiles('/dir', { recursive: true, maxDepth: 1 });
    expect(result).toEqual(['/dir/sub/c.txt']);
  });
});

describe('formatBytes()', () => {
  it('formats bytes', () => expect(formatBytes(500)).toBe('500 B'));
  it('formats kilobytes', () => expect(formatBytes(1536)).toBe('1.5 KB'));
  it('formats megabytes', () => expect(formatBytes(2 * 1024 * 1024)).toBe('2.00 MB'));
});
