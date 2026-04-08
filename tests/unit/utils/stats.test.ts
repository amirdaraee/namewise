import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/utils/fs-collect.js', () => ({
  collectFiles: vi.fn(),
  formatBytes: vi.fn((b: number) => `${b}B`)
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return { ...actual, promises: { ...(actual as any).promises, stat: vi.fn() } };
});

import { collectFiles } from '../../../src/utils/fs-collect.js';
import { promises as fs } from 'fs';
import { computeStats } from '../../../src/utils/stats.js';

beforeEach(() => vi.clearAllMocks());

describe('computeStats()', () => {
  it('returns zeros for empty directory', async () => {
    vi.mocked(collectFiles).mockResolvedValue([]);
    const result = await computeStats('/dir');
    expect(result.totalFiles).toBe(0);
    expect(result.totalBytes).toBe(0);
    expect(result.byType).toEqual([]);
    expect(result.largest).toEqual([]);
  });

  it('groups files by extension', async () => {
    vi.mocked(collectFiles).mockResolvedValue(['/dir/a.pdf', '/dir/b.pdf', '/dir/c.txt']);
    vi.mocked(fs.stat)
      .mockResolvedValueOnce({ size: 1000 } as any)
      .mockResolvedValueOnce({ size: 2000 } as any)
      .mockResolvedValueOnce({ size: 500 } as any);
    const result = await computeStats('/dir');
    expect(result.totalFiles).toBe(3);
    expect(result.totalBytes).toBe(3500);
    const pdfType = result.byType.find(t => t.ext === '.pdf')!;
    expect(pdfType.count).toBe(2);
    expect(pdfType.bytes).toBe(3000);
  });

  it('orders byType by bytes descending', async () => {
    vi.mocked(collectFiles).mockResolvedValue(['/dir/a.txt', '/dir/b.pdf']);
    vi.mocked(fs.stat)
      .mockResolvedValueOnce({ size: 100 } as any)
      .mockResolvedValueOnce({ size: 9000 } as any);
    const result = await computeStats('/dir');
    expect(result.byType[0].ext).toBe('.pdf');
  });

  it('returns largest files sorted by size descending', async () => {
    vi.mocked(collectFiles).mockResolvedValue(['/dir/small.txt', '/dir/big.pdf']);
    vi.mocked(fs.stat)
      .mockResolvedValueOnce({ size: 100 } as any)
      .mockResolvedValueOnce({ size: 9000 } as any);
    const result = await computeStats('/dir');
    expect(result.largest[0].path).toBe('/dir/big.pdf');
    expect(result.largest[1].path).toBe('/dir/small.txt');
  });

  it('caps largest list at 10 entries', async () => {
    const paths = Array.from({ length: 15 }, (_, i) => `/dir/file${i}.txt`);
    vi.mocked(collectFiles).mockResolvedValue(paths);
    vi.mocked(fs.stat).mockResolvedValue({ size: 1000 } as any);
    const result = await computeStats('/dir');
    expect(result.largest.length).toBe(10);
  });

  it('categorises files with no extension as "(no ext)"', async () => {
    vi.mocked(collectFiles).mockResolvedValue(['/dir/Makefile']);
    vi.mocked(fs.stat).mockResolvedValue({ size: 200 } as any);
    const result = await computeStats('/dir');
    expect(result.byType[0].ext).toBe('(no ext)');
  });
});
