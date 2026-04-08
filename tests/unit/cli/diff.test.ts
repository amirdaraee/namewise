import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/utils/fs-collect.js', () => ({
  collectFiles: vi.fn(),
  formatBytes: vi.fn((b: number) => `${b}B`)
}));
vi.mock('../../../src/utils/dedup.js', () => ({ hashFile: vi.fn() }));
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return { ...actual, promises: { ...(actual as any).promises, stat: vi.fn() } };
});

import { promises as fs } from 'fs';
import { collectFiles } from '../../../src/utils/fs-collect.js';
import { hashFile } from '../../../src/utils/dedup.js';
import { diffDirectories } from '../../../src/cli/diff.js';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
  vi.mocked(collectFiles).mockResolvedValue([]);
});

describe('diffDirectories()', () => {
  it('throws when dir1 is not a directory', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false } as any);
    await expect(diffDirectories('/a', '/b', {})).rejects.toThrow('is not a directory');
  });

  it('throws when dir2 is not a directory', async () => {
    vi.mocked(fs.stat)
      .mockResolvedValueOnce({ isDirectory: () => true } as any)
      .mockResolvedValueOnce({ isDirectory: () => false } as any);
    await expect(diffDirectories('/a', '/b', {})).rejects.toThrow('is not a directory');
  });

  it('reports "Directories are identical." when both are empty', async () => {
    vi.mocked(collectFiles).mockResolvedValue([]);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await diffDirectories('/a', '/b', {});
    expect(spy.mock.calls.map(c => c[0]).join('\n')).toContain('Directories are identical.');
    spy.mockRestore();
  });

  it('reports "Directories are identical." when both have same files', async () => {
    vi.mocked(collectFiles)
      .mockResolvedValueOnce(['/a/file.txt'])
      .mockResolvedValueOnce(['/b/file.txt']);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await diffDirectories('/a', '/b', {});
    expect(spy.mock.calls.map(c => c[0]).join('\n')).toContain('Directories are identical.');
    spy.mockRestore();
  });

  it('shows files only in dir1', async () => {
    vi.mocked(collectFiles)
      .mockResolvedValueOnce(['/a/file.txt'])
      .mockResolvedValueOnce([]);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await diffDirectories('/a', '/b', {});
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Only in');
    expect(output).toContain('file.txt');
    spy.mockRestore();
  });

  it('shows files only in dir2', async () => {
    vi.mocked(collectFiles)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(['/b/other.pdf']);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await diffDirectories('/a', '/b', {});
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Only in');
    expect(output).toContain('other.pdf');
    spy.mockRestore();
  });

  it('detects moved files by hash in --by hash mode', async () => {
    vi.mocked(collectFiles)
      .mockResolvedValueOnce(['/a/original.txt'])
      .mockResolvedValueOnce(['/b/renamed.txt']);
    vi.mocked(hashFile).mockResolvedValue('abc123');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await diffDirectories('/a', '/b', { by: 'hash' });
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Moved/renamed');
    spy.mockRestore();
  });

  it('hash mode: file unique to dir1 goes to stillOnlyIn1 when hashes differ', async () => {
    // dir1/unique.txt has no hash match in dir2 (different hashes) → shows in "Only in dir1"
    vi.mocked(collectFiles)
      .mockResolvedValueOnce(['/a/unique.txt'])
      .mockResolvedValueOnce(['/b/other.txt']);
    vi.mocked(hashFile)
      .mockResolvedValueOnce('hash-a')   // /a/unique.txt
      .mockResolvedValueOnce('hash-b');  // /b/other.txt — different hash → no match
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await diffDirectories('/a', '/b', { by: 'hash' });
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('unique.txt');
    spy.mockRestore();
  });

  it('hash mode: file only in dir2 (onlyIn1 empty) triggers diffByHash via right side of ||', async () => {
    vi.mocked(collectFiles)
      .mockResolvedValueOnce(['/a/shared.txt'])
      .mockResolvedValueOnce(['/b/shared.txt', '/b/extra.txt']);
    vi.mocked(hashFile).mockResolvedValue('same-hash');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await diffDirectories('/a', '/b', { by: 'hash' });
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    // shared.txt has same name → not in onlyIn1/onlyIn2; extra.txt only in dir2
    expect(output).toContain('extra.txt');
    spy.mockRestore();
  });

  it('shows total difference count', async () => {
    vi.mocked(collectFiles)
      .mockResolvedValueOnce(['/a/file1.txt', '/a/file2.txt'])
      .mockResolvedValueOnce(['/b/file3.txt']);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await diffDirectories('/a', '/b', {});
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('difference(s) found.');
    spy.mockRestore();
  });
});
