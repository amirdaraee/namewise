import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      ...(actual as any).promises,
      stat: vi.fn(),
      readdir: vi.fn(),
      rmdir: vi.fn().mockResolvedValue(undefined)
    }
  };
});

import { promises as fs } from 'fs';
import { cleanEmptyDirs } from '../../../src/cli/clean-empty.js';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
});

describe('cleanEmptyDirs()', () => {
  it('throws when path is not a directory', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false } as any);
    await expect(cleanEmptyDirs('/f')).rejects.toThrow('is not a directory');
  });

  it('prints "No empty directories found." when none exist', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: 'a.txt', isDirectory: () => false, isFile: () => true } as any
    ]);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cleanEmptyDirs('/dir');
    expect(spy.mock.calls.map(c => c[0]).join('\n')).toContain('No empty directories found.');
    spy.mockRestore();
  });

  it('finds an empty subdirectory', async () => {
    vi.mocked(fs.readdir)
      .mockResolvedValueOnce([
        { name: 'empty-sub', isDirectory: () => true, isFile: () => false } as any
      ])
      .mockResolvedValueOnce([]); // empty-sub has no children
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cleanEmptyDirs('/dir');
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('empty-sub');
    spy.mockRestore();
  });

  it('does not delete in dry-run mode', async () => {
    vi.mocked(fs.readdir)
      .mockResolvedValueOnce([
        { name: 'empty-sub', isDirectory: () => true, isFile: () => false } as any
      ])
      .mockResolvedValueOnce([]);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await cleanEmptyDirs('/dir', { dryRun: true });
    expect(fs.rmdir).not.toHaveBeenCalled();
  });

  it('deletes empty directories when not dry-run', async () => {
    vi.mocked(fs.readdir)
      .mockResolvedValueOnce([
        { name: 'empty-sub', isDirectory: () => true, isFile: () => false } as any
      ])
      .mockResolvedValueOnce([]);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await cleanEmptyDirs('/dir');
    expect(fs.rmdir).toHaveBeenCalledWith('/dir/empty-sub');
  });

  it('uses plural "ies" when removing multiple empty directories', async () => {
    vi.mocked(fs.readdir)
      .mockResolvedValueOnce([
        { name: 'empty1', isDirectory: () => true, isFile: () => false } as any,
        { name: 'empty2', isDirectory: () => true, isFile: () => false } as any
      ])
      .mockResolvedValueOnce([]) // empty1 children
      .mockResolvedValueOnce([]); // empty2 children
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cleanEmptyDirs('/dir');
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('directories');
    spy.mockRestore();
  });

  it('does not delete directories that contain files', async () => {
    vi.mocked(fs.readdir)
      .mockResolvedValueOnce([
        { name: 'non-empty', isDirectory: () => true, isFile: () => false } as any
      ])
      .mockResolvedValueOnce([
        { name: 'file.txt', isDirectory: () => false, isFile: () => true } as any
      ]);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await cleanEmptyDirs('/dir');
    expect(fs.rmdir).not.toHaveBeenCalled();
  });
});
