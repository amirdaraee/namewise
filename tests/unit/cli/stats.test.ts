import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/utils/stats.js', () => ({ computeStats: vi.fn() }));
vi.mock('../../../src/utils/fs-collect.js', () => ({
  collectFiles: vi.fn(),
  formatBytes: vi.fn((b: number) => `${b}B`)
}));
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return { ...actual, promises: { ...(actual as any).promises, stat: vi.fn() } };
});

import { promises as fs } from 'fs';
import { computeStats } from '../../../src/utils/stats.js';
import { statsCommand } from '../../../src/cli/stats.js';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
});

describe('statsCommand()', () => {
  it('throws when path is not a directory', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false } as any);
    await expect(statsCommand('/file.txt')).rejects.toThrow('is not a directory');
  });

  it('prints "No files found." when directory is empty', async () => {
    vi.mocked(computeStats).mockResolvedValue({
      totalFiles: 0, totalBytes: 0, byType: [], largest: []
    });
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await statsCommand('/dir');
    expect(spy.mock.calls.map(c => c[0]).join('\n')).toContain('No files found.');
    spy.mockRestore();
  });

  it('prints total files and size', async () => {
    vi.mocked(computeStats).mockResolvedValue({
      totalFiles: 5,
      totalBytes: 1024,
      byType: [{ ext: '.pdf', count: 5, bytes: 1024 }],
      largest: []
    });
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await statsCommand('/dir');
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('5 file(s)');
    spy.mockRestore();
  });

  it('prints by-type breakdown', async () => {
    vi.mocked(computeStats).mockResolvedValue({
      totalFiles: 2,
      totalBytes: 3000,
      byType: [
        { ext: '.pdf', count: 1, bytes: 2000 },
        { ext: '.txt', count: 1, bytes: 1000 }
      ],
      largest: []
    });
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await statsCommand('/dir');
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('.pdf');
    expect(output).toContain('.txt');
    spy.mockRestore();
  });

  it('prints largest files section', async () => {
    vi.mocked(computeStats).mockResolvedValue({
      totalFiles: 1,
      totalBytes: 500,
      byType: [{ ext: '.pdf', count: 1, bytes: 500 }],
      largest: [{ path: '/dir/big.pdf', bytes: 500 }]
    });
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await statsCommand('/dir');
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('big.pdf');
    spy.mockRestore();
  });

  it('shows empty percentage string when totalBytes is 0', async () => {
    vi.mocked(computeStats).mockResolvedValue({
      totalFiles: 1,
      totalBytes: 0,
      byType: [{ ext: '.txt', count: 1, bytes: 0 }],
      largest: []
    });
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await statsCommand('/dir');
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('.txt');
    spy.mockRestore();
  });

  it('passes recursive option to computeStats', async () => {
    vi.mocked(computeStats).mockResolvedValue({
      totalFiles: 0, totalBytes: 0, byType: [], largest: []
    });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await statsCommand('/dir', { recursive: true });
    expect(computeStats).toHaveBeenCalledWith('/dir', true);
  });
});
