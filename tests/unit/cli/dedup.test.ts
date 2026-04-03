import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/utils/dedup.js', () => ({
  findDuplicates: vi.fn()
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      ...(actual as any).promises,
      stat: vi.fn(),
      unlink: vi.fn().mockResolvedValue(undefined)
    }
  };
});

vi.mock('inquirer', () => ({
  default: { prompt: vi.fn() }
}));

import { promises as fs } from 'fs';
import inquirer from 'inquirer';
import { findDuplicates } from '../../../src/utils/dedup.js';
import { dedupFiles } from '../../../src/cli/dedup.js';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true, size: 1536 } as any);
  vi.mocked(findDuplicates).mockResolvedValue(new Map());
});

describe('dedupFiles()', () => {
  it('throws when path is not a directory', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false } as any);
    await expect(dedupFiles('/file.txt')).rejects.toThrow('is not a directory');
  });

  it('prints "No duplicate files found." when no duplicates exist', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await dedupFiles('/dir');
    expect(spy).toHaveBeenCalledWith('No duplicate files found.');
    spy.mockRestore();
  });

  it('prints duplicate groups when duplicates are found', async () => {
    vi.mocked(findDuplicates).mockResolvedValue(new Map([
      ['abc123', ['/dir/a.txt', '/dir/b.txt']]
    ]));
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await dedupFiles('/dir');
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('[keep]');
    expect(output).toContain('[dupe]');
    // verify size information is shown
    expect(output).toContain('(');
    expect(output).toMatch(/\(\d+(\.\d+)? (B|KB|MB)\)/);
    spy.mockRestore();
  });

  it('keeps the lexicographically earliest path when paths are unsorted', async () => {
    // paths returned in reverse alphabetical order
    vi.mocked(findDuplicates).mockResolvedValue(new Map([
      ['abc123', ['/dir/z.txt', '/dir/a.txt']]
    ]));
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await dedupFiles('/dir');
    const lines = spy.mock.calls.map(c => c[0]);
    const keepLine = lines.find(l => l.includes('[keep]'));
    const dupeLine = lines.find(l => l.includes('[dupe]'));
    expect(keepLine).toContain('/dir/a.txt');
    expect(dupeLine).toContain('/dir/z.txt');
    spy.mockRestore();
  });

  it('shows size in bytes (B) for small files', async () => {
    vi.mocked(findDuplicates).mockResolvedValue(new Map([
      ['abc123', ['/dir/a.txt', '/dir/b.txt']]
    ]));
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true, size: 512 } as any);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await dedupFiles('/dir');
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('512 B');
    spy.mockRestore();
  });

  it('shows size in megabytes (MB) for large files', async () => {
    vi.mocked(findDuplicates).mockResolvedValue(new Map([
      ['abc123', ['/dir/a.txt', '/dir/b.txt']]
    ]));
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true, size: 2 * 1024 * 1024 } as any);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await dedupFiles('/dir');
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('2.00 MB');
    spy.mockRestore();
  });

  it('does not delete without --delete flag', async () => {
    vi.mocked(findDuplicates).mockResolvedValue(new Map([
      ['abc123', ['/dir/a.txt', '/dir/b.txt']]
    ]));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await dedupFiles('/dir', { delete: false });
    expect(fs.unlink).not.toHaveBeenCalled();
  });

  it('prompts for confirmation before deleting', async () => {
    vi.mocked(findDuplicates).mockResolvedValue(new Map([
      ['abc123', ['/dir/a.txt', '/dir/b.txt']]
    ]));
    vi.mocked(inquirer.prompt).mockResolvedValue({ confirm: false } as any);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await dedupFiles('/dir', { delete: true });
    expect(inquirer.prompt).toHaveBeenCalled();
    expect(fs.unlink).not.toHaveBeenCalled();
  });

  it('deletes duplicates when user confirms', async () => {
    vi.mocked(findDuplicates).mockResolvedValue(new Map([
      ['abc123', ['/dir/a.txt', '/dir/b.txt']]
    ]));
    vi.mocked(inquirer.prompt).mockResolvedValue({ confirm: true } as any);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await dedupFiles('/dir', { delete: true });
    expect(fs.unlink).toHaveBeenCalledWith('/dir/b.txt');
    expect(fs.unlink).not.toHaveBeenCalledWith('/dir/a.txt');
  });
});
