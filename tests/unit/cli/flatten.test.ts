import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      ...(actual as any).promises,
      stat: vi.fn(),
      readdir: vi.fn(),
      rename: vi.fn().mockResolvedValue(undefined),
      access: vi.fn()
    }
  };
});
vi.mock('../../../src/utils/history.js', () => ({ appendHistory: vi.fn() }));

import { promises as fs } from 'fs';
import { flattenDirectory } from '../../../src/cli/flatten.js';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
});

describe('flattenDirectory()', () => {
  it('throws when path is not a directory', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false } as any);
    await expect(flattenDirectory('/file.txt')).rejects.toThrow('is not a directory');
  });

  it('prints "No nested files found." when directory is already flat', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: 'a.txt', isDirectory: () => false, isFile: () => true } as any
    ]);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await flattenDirectory('/dir');
    expect(spy.mock.calls.map(c => c[0]).join('\n')).toContain('No nested files found.');
    spy.mockRestore();
  });

  it('dry-runs without moving nested files', async () => {
    vi.mocked(fs.readdir)
      .mockResolvedValueOnce([
        { name: 'sub', isDirectory: () => true, isFile: () => false } as any
      ])
      .mockResolvedValueOnce([
        { name: 'b.txt', isDirectory: () => false, isFile: () => true } as any
      ]);
    vi.mocked(fs.access).mockRejectedValue(new Error('not found'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await flattenDirectory('/dir', { dryRun: true });
    expect(fs.rename).not.toHaveBeenCalled();
  });

  it('moves nested files to root when not dry-run', async () => {
    vi.mocked(fs.readdir)
      .mockResolvedValueOnce([
        { name: 'sub', isDirectory: () => true, isFile: () => false } as any
      ])
      .mockResolvedValueOnce([
        { name: 'b.txt', isDirectory: () => false, isFile: () => true } as any
      ]);
    vi.mocked(fs.access).mockRejectedValue(new Error('not found'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await flattenDirectory('/dir');
    expect(fs.rename).toHaveBeenCalledWith('/dir/sub/b.txt', '/dir/b.txt');
  });

  it('collects files from deeply nested subdirectories', async () => {
    // dir/ → sub/ → nested/ → deep.txt  (3 levels deep)
    vi.mocked(fs.readdir)
      .mockResolvedValueOnce([
        { name: 'sub', isDirectory: () => true, isFile: () => false } as any
      ])
      .mockResolvedValueOnce([
        { name: 'nested', isDirectory: () => true, isFile: () => false } as any
      ])
      .mockResolvedValueOnce([
        { name: 'deep.txt', isDirectory: () => false, isFile: () => true } as any
      ]);
    vi.mocked(fs.access).mockRejectedValue(new Error('not found'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await flattenDirectory('/dir');
    expect(fs.rename).toHaveBeenCalledWith('/dir/sub/nested/deep.txt', '/dir/deep.txt');
  });

  it('resolves naming conflict by appending -1', async () => {
    vi.mocked(fs.readdir)
      .mockResolvedValueOnce([
        { name: 'sub', isDirectory: () => true, isFile: () => false } as any
      ])
      .mockResolvedValueOnce([
        { name: 'b.txt', isDirectory: () => false, isFile: () => true } as any
      ]);
    // /dir/b.txt exists, /dir/b-1.txt does not
    vi.mocked(fs.access)
      .mockResolvedValueOnce(undefined)       // b.txt exists → conflict
      .mockRejectedValueOnce(new Error());    // b-1.txt free
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await flattenDirectory('/dir');
    expect(fs.rename).toHaveBeenCalledWith('/dir/sub/b.txt', '/dir/b-1.txt');
  });
});
