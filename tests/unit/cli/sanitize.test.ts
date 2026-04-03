import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      ...(actual as any).promises,
      stat: vi.fn(),
      readdir: vi.fn(),
      rename: vi.fn().mockResolvedValue(undefined)
    }
  };
});

vi.mock('../../../src/utils/history.js', () => ({
  appendHistory: vi.fn().mockResolvedValue(undefined)
}));

import { promises as fs } from 'fs';
import { appendHistory } from '../../../src/utils/history.js';
import { sanitizeFiles } from '../../../src/cli/sanitize.js';

const mockStat = vi.mocked(fs.stat);
const mockReaddir = vi.mocked(fs.readdir);

beforeEach(() => {
  vi.clearAllMocks();
  mockStat.mockResolvedValue({ isDirectory: () => true } as any);
  mockReaddir.mockResolvedValue([]);
});

describe('sanitizeFiles()', () => {
  it('throws when path is not a directory', async () => {
    mockStat.mockResolvedValue({ isDirectory: () => false } as any);
    await expect(sanitizeFiles('/some/file.txt', {})).rejects.toThrow('is not a directory');
  });

  it('prints "No files found." when directory is empty', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await sanitizeFiles('/empty/dir', {});
    expect(spy).toHaveBeenCalledWith('No files found.');
    spy.mockRestore();
  });

  it('renames files whose names change after sanitization', async () => {
    mockReaddir.mockResolvedValue([
      { name: 'Report<2024>.txt', isDirectory: () => false, isFile: () => true } as any
    ]);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await sanitizeFiles('/test/dir', { dryRun: false });
    expect(fs.rename).toHaveBeenCalled();
    expect(appendHistory).toHaveBeenCalled();
  });

  it('does not rename files in dry-run mode', async () => {
    mockReaddir.mockResolvedValue([
      { name: 'Report<2024>.txt', isDirectory: () => false, isFile: () => true } as any
    ]);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await sanitizeFiles('/test/dir', { dryRun: true });
    expect(fs.rename).not.toHaveBeenCalled();
    expect(appendHistory).not.toHaveBeenCalled();
  });

  it('reports correct count in dry-run summary', async () => {
    mockReaddir.mockResolvedValue([
      { name: 'Report<2024>.txt', isDirectory: () => false, isFile: () => true } as any
    ]);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await sanitizeFiles('/test/dir', { dryRun: true });
    const output = spy.mock.calls.map(c => String(c[0])).join('\n');
    expect(output).toMatch(/1 file\(s\) would be sanitized/);
    spy.mockRestore();
  });

  it('skips files whose names are already clean', async () => {
    mockReaddir.mockResolvedValue([
      { name: 'clean-name.txt', isDirectory: () => false, isFile: () => true } as any
    ]);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await sanitizeFiles('/test/dir', {});
    expect(fs.rename).not.toHaveBeenCalled();
  });

  it('recursively collects files from subdirectories when recursive is true', async () => {
    mockReaddir.mockImplementation(async (dirPath: any) => {
      if (String(dirPath) === '/test/dir') {
        return [
          { name: 'Report<2024>.txt', isDirectory: () => false, isFile: () => true },
          { name: 'subdir', isDirectory: () => true, isFile: () => false }
        ] as any;
      }
      // subdirectory call
      return [
        { name: 'File<deep>.txt', isDirectory: () => false, isFile: () => true }
      ] as any;
    });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await sanitizeFiles('/test/dir', { recursive: true });
    expect(fs.rename).toHaveBeenCalledTimes(2);
  });
});
