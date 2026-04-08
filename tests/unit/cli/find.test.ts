import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/utils/fs-collect.js', () => ({
  collectFiles: vi.fn(),
  formatBytes: vi.fn((b: number) => `${b}B`)
}));
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return { ...actual, promises: { ...(actual as any).promises, stat: vi.fn() } };
});

import { promises as fs } from 'fs';
import { collectFiles } from '../../../src/utils/fs-collect.js';
import { findFiles } from '../../../src/cli/find.js';

const d = (s: string) => new Date(s);
const makeStat = (size: number, mtime: Date) => ({
  isDirectory: () => false, size, mtime, birthtime: mtime
} as any);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
  vi.mocked(collectFiles).mockResolvedValue([]);
});

describe('findFiles()', () => {
  it('throws when path is not a directory', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false } as any);
    await expect(findFiles('/f', {})).rejects.toThrow('is not a directory');
  });

  it('prints "No files matched." when nothing matches', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await findFiles('/dir', {});
    expect(spy.mock.calls.map(c => c[0]).join('\n')).toContain('No files matched.');
    spy.mockRestore();
  });

  it('filters by extension', async () => {
    vi.mocked(collectFiles).mockResolvedValue(['/dir/a.pdf', '/dir/b.txt']);
    vi.mocked(fs.stat)
      .mockResolvedValueOnce({ isDirectory: () => true } as any)
      .mockResolvedValueOnce(makeStat(100, d('2024-01-01')))
      .mockResolvedValueOnce(makeStat(100, d('2024-01-01')));
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await findFiles('/dir', { ext: 'pdf' });
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('a.pdf');
    expect(output).not.toContain('b.txt');
    spy.mockRestore();
  });

  it('filters by extension with leading dot', async () => {
    vi.mocked(collectFiles).mockResolvedValue(['/dir/a.pdf', '/dir/b.txt']);
    vi.mocked(fs.stat)
      .mockResolvedValueOnce({ isDirectory: () => true } as any)
      .mockResolvedValueOnce(makeStat(100, d('2024-01-01')))
      .mockResolvedValueOnce(makeStat(100, d('2024-01-01')));
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await findFiles('/dir', { ext: '.pdf' });
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('a.pdf');
    expect(output).not.toContain('b.txt');
    spy.mockRestore();
  });

  it('filters by --larger-than', async () => {
    vi.mocked(collectFiles).mockResolvedValue(['/dir/small.txt', '/dir/big.pdf']);
    vi.mocked(fs.stat)
      .mockResolvedValueOnce({ isDirectory: () => true } as any)
      .mockResolvedValueOnce(makeStat(500, d('2024-01-01')))
      .mockResolvedValueOnce(makeStat(5 * 1024 * 1024, d('2024-01-01')));
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await findFiles('/dir', { largerThan: '1mb' });
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('big.pdf');
    expect(output).not.toContain('small.txt');
    spy.mockRestore();
  });

  it('filters by --smaller-than', async () => {
    vi.mocked(collectFiles).mockResolvedValue(['/dir/small.txt', '/dir/big.pdf']);
    vi.mocked(fs.stat)
      .mockResolvedValueOnce({ isDirectory: () => true } as any)
      .mockResolvedValueOnce(makeStat(500, d('2024-01-01')))
      .mockResolvedValueOnce(makeStat(5 * 1024 * 1024, d('2024-01-01')));
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await findFiles('/dir', { smallerThan: '1mb' });
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('small.txt');
    expect(output).not.toContain('big.pdf');
    spy.mockRestore();
  });

  it('filters by --newer-than date', async () => {
    vi.mocked(collectFiles).mockResolvedValue(['/dir/old.txt', '/dir/new.txt']);
    vi.mocked(fs.stat)
      .mockResolvedValueOnce({ isDirectory: () => true } as any)
      .mockResolvedValueOnce(makeStat(100, d('2023-01-01')))
      .mockResolvedValueOnce(makeStat(100, d('2025-06-01')));
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await findFiles('/dir', { newerThan: '2024-01-01' });
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('new.txt');
    expect(output).not.toContain('old.txt');
    spy.mockRestore();
  });

  it('filters by --older-than date', async () => {
    vi.mocked(collectFiles).mockResolvedValue(['/dir/old.txt', '/dir/new.txt']);
    vi.mocked(fs.stat)
      .mockResolvedValueOnce({ isDirectory: () => true } as any)
      .mockResolvedValueOnce(makeStat(100, d('2022-01-01')))
      .mockResolvedValueOnce(makeStat(100, d('2025-06-01')));
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await findFiles('/dir', { olderThan: '2024-01-01' });
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('old.txt');
    expect(output).not.toContain('new.txt');
    spy.mockRestore();
  });

  it('filters by --name glob', async () => {
    vi.mocked(collectFiles).mockResolvedValue(['/dir/report-2024.pdf', '/dir/photo.jpg']);
    vi.mocked(fs.stat)
      .mockResolvedValueOnce({ isDirectory: () => true } as any)
      .mockResolvedValueOnce(makeStat(100, d('2024-01-01')))
      .mockResolvedValueOnce(makeStat(100, d('2024-01-01')));
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await findFiles('/dir', { name: '*.pdf' });
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('report-2024.pdf');
    expect(output).not.toContain('photo.jpg');
    spy.mockRestore();
  });

  it('filters by --larger-than in KB', async () => {
    vi.mocked(collectFiles).mockResolvedValue(['/dir/small.txt', '/dir/big.txt']);
    vi.mocked(fs.stat)
      .mockResolvedValueOnce({ isDirectory: () => true } as any)
      .mockResolvedValueOnce(makeStat(100, d('2024-01-01')))
      .mockResolvedValueOnce(makeStat(500 * 1024, d('2024-01-01')));
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await findFiles('/dir', { largerThan: '200kb' });
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('big.txt');
    expect(output).not.toContain('small.txt');
    spy.mockRestore();
  });

  it('filters by --smaller-than in GB', async () => {
    vi.mocked(collectFiles).mockResolvedValue(['/dir/small.txt', '/dir/huge.iso']);
    vi.mocked(fs.stat)
      .mockResolvedValueOnce({ isDirectory: () => true } as any)
      .mockResolvedValueOnce(makeStat(1000, d('2024-01-01')))
      .mockResolvedValueOnce(makeStat(5 * 1024 * 1024 * 1024, d('2024-01-01')));
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await findFiles('/dir', { smallerThan: '2gb' });
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('small.txt');
    expect(output).not.toContain('huge.iso');
    spy.mockRestore();
  });

  it('filters by --larger-than in raw bytes', async () => {
    vi.mocked(collectFiles).mockResolvedValue(['/dir/tiny.txt', '/dir/medium.txt']);
    vi.mocked(fs.stat)
      .mockResolvedValueOnce({ isDirectory: () => true } as any)
      .mockResolvedValueOnce(makeStat(50, d('2024-01-01')))
      .mockResolvedValueOnce(makeStat(2000, d('2024-01-01')));
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await findFiles('/dir', { largerThan: '500' });
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('medium.txt');
    expect(output).not.toContain('tiny.txt');
    spy.mockRestore();
  });

  it('prints match count', async () => {
    vi.mocked(collectFiles).mockResolvedValue(['/dir/a.pdf', '/dir/b.pdf']);
    vi.mocked(fs.stat)
      .mockResolvedValueOnce({ isDirectory: () => true } as any)
      .mockResolvedValueOnce(makeStat(100, d('2024-01-01')))
      .mockResolvedValueOnce(makeStat(100, d('2024-01-01')));
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await findFiles('/dir', {});
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('2 file(s) matched.');
    spy.mockRestore();
  });
});
