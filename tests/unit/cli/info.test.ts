import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      ...(actual as any).promises,
      stat: vi.fn(),
      readdir: vi.fn()
    },
    createReadStream: vi.fn()
  };
});

import { promises as fs, createReadStream } from 'fs';
import { infoCommand } from '../../../src/cli/info.js';

const fakeDate = new Date('2024-03-15T09:00:00Z');
const fakeFileStat = {
  isDirectory: () => false,
  size: 4096,
  birthtime: fakeDate,
  mtime: fakeDate,
  atime: fakeDate
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fs.stat).mockResolvedValue(fakeFileStat as any);
  // Mock createReadStream to simulate SHA-256 hashing finishing immediately
  const mockStream = {
    on: vi.fn().mockImplementation(function (this: any, event: string, cb: Function) {
      if (event === 'end') setTimeout(() => cb(), 0);
      return this;
    })
  };
  vi.mocked(createReadStream).mockReturnValue(mockStream as any);
});

describe('infoCommand() — file', () => {
  it('prints file size in bytes', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await infoCommand('/dir/file.pdf');
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('4096 bytes');
    spy.mockRestore();
  });

  it('prints file extension', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await infoCommand('/dir/file.pdf');
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('.pdf');
    spy.mockRestore();
  });

  it('prints SHA-256 label', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await infoCommand('/dir/file.pdf');
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('SHA-256');
    spy.mockRestore();
  });

  it('shows "(none)" for extension-less files', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await infoCommand('/dir/Makefile');
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('(none)');
    spy.mockRestore();
  });
});

describe('infoCommand() — directory', () => {
  it('shows Directory: label', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
    vi.mocked(fs.readdir).mockResolvedValue([]);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await infoCommand('/dir');
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Directory:');
    spy.mockRestore();
  });

  it('shows Files: count', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
    vi.mocked(fs.readdir).mockResolvedValue([]);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await infoCommand('/dir');
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Files:');
    spy.mockRestore();
  });

  it('counts files and subdirectories using walkDir both branches', async () => {
    // This test exercises: isDirectory branch (dirCount++) AND file branch (fileCount++, totalBytes += size)
    // dir/ has: sub/ (dir) + a.txt (file); sub/ has: b.txt (file)
    vi.mocked(fs.stat)
      .mockResolvedValueOnce({ isDirectory: () => true } as any)  // initial infoCommand stat
      .mockResolvedValueOnce({ size: 100 } as any)                // walkDir: stat for a.txt
      .mockResolvedValueOnce({ size: 200 } as any);               // walkDir: stat for b.txt in sub
    vi.mocked(fs.readdir)
      .mockResolvedValueOnce([
        { name: 'sub', isDirectory: () => true, isFile: () => false } as any,
        { name: 'a.txt', isDirectory: () => false, isFile: () => true } as any
      ])
      .mockResolvedValueOnce([
        { name: 'b.txt', isDirectory: () => false, isFile: () => true } as any
      ]);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await infoCommand('/dir');
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Files:       2');
    expect(output).toContain('Directories: 1');
    spy.mockRestore();
  });
});
