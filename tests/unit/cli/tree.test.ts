import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      ...(actual as any).promises,
      stat: vi.fn(),
      readdir: vi.fn()
    }
  };
});

import { promises as fs } from 'fs';
import { treeCommand } from '../../../src/cli/tree.js';

beforeEach(() => vi.clearAllMocks());

describe('treeCommand()', () => {
  it('throws when path is not a directory', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false } as any);
    await expect(treeCommand('/file.txt')).rejects.toThrow('is not a directory');
  });

  it('prints file with size', async () => {
    vi.mocked(fs.stat)
      .mockResolvedValueOnce({ isDirectory: () => true } as any)  // initial check
      .mockResolvedValueOnce({ size: 1024, isDirectory: () => false } as any); // file stat
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: 'notes.txt', isDirectory: () => false, isFile: () => true } as any
    ]);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await treeCommand('/dir');
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('notes.txt');
    spy.mockRestore();
  });

  it('shows directories before files', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
    vi.mocked(fs.readdir)
      .mockResolvedValueOnce([
        { name: 'zfile.txt', isDirectory: () => false, isFile: () => true } as any,
        { name: 'adir', isDirectory: () => true, isFile: () => false } as any
      ])
      .mockResolvedValueOnce([]); // adir is empty
    vi.mocked(fs.stat)
      .mockResolvedValueOnce({ isDirectory: () => true } as any)  // initial check
      .mockResolvedValueOnce({ size: 100, isDirectory: () => false } as any); // zfile stat
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await treeCommand('/dir');
    const lines = spy.mock.calls.map(c => c[0]);
    const aIndex = lines.findIndex(l => typeof l === 'string' && l.includes('adir'));
    const zIndex = lines.findIndex(l => typeof l === 'string' && l.includes('zfile'));
    expect(aIndex).toBeGreaterThan(-1);
    expect(zIndex).toBeGreaterThan(-1);
    expect(aIndex).toBeLessThan(zIndex);
    spy.mockRestore();
  });

  it('stops recursing when maxDepth is reached', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
    vi.mocked(fs.readdir)
      .mockResolvedValueOnce([
        { name: 'sub', isDirectory: () => true, isFile: () => false } as any
      ])
      .mockResolvedValueOnce([]); // dirSummary for sub
    // printTree(sub, ..., depth=1, maxDepth=1) → depth >= maxDepth → early return, no readdir for sub contents
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await treeCommand('/dir', { depth: 1 });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('sort: dir comes first when dir is second entry (return -1 branch)', async () => {
    // entries in order: [file.txt, zdir] — sort must compare (file.txt, zdir) → a=file, b=dir
    // but ALSO compare (zdir, file.txt) → a=dir, b=file → line 28: return -1
    vi.mocked(fs.stat)
      .mockResolvedValueOnce({ isDirectory: () => true } as any)  // initial check
      .mockResolvedValueOnce({ size: 100, isDirectory: () => false } as any); // file.txt stat
    vi.mocked(fs.readdir)
      .mockResolvedValueOnce([
        { name: 'zdir', isDirectory: () => true, isFile: () => false } as any,
        { name: 'afile.txt', isDirectory: () => false, isFile: () => true } as any
      ])
      .mockResolvedValueOnce([]); // dirSummary for zdir (empty)
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await treeCommand('/dir');
    const lines = spy.mock.calls.map(c => c[0]) as string[];
    const dirIdx = lines.findIndex(l => l.includes('zdir'));
    const fileIdx = lines.findIndex(l => l.includes('afile'));
    expect(dirIdx).toBeLessThan(fileIdx);
    spy.mockRestore();
  });

  it('sorts two files alphabetically (localeCompare branch)', async () => {
    // Both entries are files → neither sort condition returns -1 or 1 → localeCompare used
    vi.mocked(fs.stat)
      .mockResolvedValueOnce({ isDirectory: () => true } as any)  // initial check
      .mockResolvedValueOnce({ size: 100, isDirectory: () => false } as any) // z.txt
      .mockResolvedValueOnce({ size: 50, isDirectory: () => false } as any);  // a.txt
    vi.mocked(fs.readdir).mockResolvedValueOnce([
      { name: 'z.txt', isDirectory: () => false, isFile: () => true } as any,
      { name: 'a.txt', isDirectory: () => false, isFile: () => true } as any
    ]);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await treeCommand('/dir');
    const lines = spy.mock.calls.map(c => c[0]) as string[];
    const aIdx = lines.findIndex(l => l.includes('a.txt'));
    const zIdx = lines.findIndex(l => l.includes('z.txt'));
    expect(aIdx).toBeLessThan(zIdx); // a sorts before z
    spy.mockRestore();
  });

  it('sort: file alphabetically before dir gets placed after dir (return 1 branch)', async () => {
    // 'a.txt' < 'b-dir' alphabetically, but b-dir is a directory so it must come first
    vi.mocked(fs.stat)
      .mockResolvedValueOnce({ isDirectory: () => true } as any)  // initial check
      .mockResolvedValueOnce({ size: 50 } as any);                // a.txt stat
    vi.mocked(fs.readdir)
      .mockResolvedValueOnce([
        { name: 'a.txt', isDirectory: () => false, isFile: () => true } as any,
        { name: 'b-dir', isDirectory: () => true, isFile: () => false } as any
      ])
      .mockResolvedValueOnce([]); // b-dir is empty
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await treeCommand('/dir');
    const lines = spy.mock.calls.map(c => c[0]) as string[];
    const dirIdx = lines.findIndex(l => l.includes('b-dir'));
    const fileIdx = lines.findIndex(l => l.includes('a.txt'));
    expect(dirIdx).toBeLessThan(fileIdx);
    spy.mockRestore();
  });

  it('dirSummary silently handles readdir errors (catch branch)', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
    vi.mocked(fs.readdir)
      .mockResolvedValueOnce([
        { name: 'locked', isDirectory: () => true, isFile: () => false } as any
      ])
      // dirSummary('locked') throws → caught silently
      .mockRejectedValueOnce(new Error('EACCES'))
      // printTree recurses into 'locked' — empty
      .mockResolvedValueOnce([]);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await expect(treeCommand('/dir')).resolves.toBeUndefined();
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('locked/');
    spy.mockRestore();
  });

  it('dirSummary recurses into nested subdirectories (line 70 branch)', async () => {
    // root → sub/ → nested/ → (empty)
    // dirSummary(sub) finds 'nested' is a dir → calls dirSummary(nested) recursively
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true, size: 0 } as any);
    vi.mocked(fs.readdir)
      .mockResolvedValueOnce([                                   // printTree reads root
        { name: 'sub', isDirectory: () => true, isFile: () => false } as any
      ])
      .mockResolvedValueOnce([                                   // dirSummary(sub)
        { name: 'nested', isDirectory: () => true, isFile: () => false } as any
      ])
      .mockResolvedValueOnce([])                                 // dirSummary(nested) → empty
      .mockResolvedValueOnce([                                   // printTree(sub)
        { name: 'nested', isDirectory: () => true, isFile: () => false } as any
      ])
      .mockResolvedValueOnce([])                                 // dirSummary(nested) in printTree(sub)
      .mockResolvedValueOnce([]);                                // printTree(nested)
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await treeCommand('/dir');
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('sub/');
    expect(output).toContain('nested/');
    spy.mockRestore();
  });

  it('shows directory with file count and size summary', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true, size: 0 } as any);
    vi.mocked(fs.readdir)
      .mockResolvedValueOnce([
        { name: 'sub', isDirectory: () => true, isFile: () => false } as any
      ])
      .mockResolvedValueOnce([
        { name: 'a.txt', isDirectory: () => false, isFile: () => true } as any
      ])
      .mockResolvedValueOnce([]); // for printTree recursion into sub (empty after)
    vi.mocked(fs.stat)
      .mockResolvedValueOnce({ isDirectory: () => true } as any) // initial check
      .mockResolvedValueOnce({ size: 500, isDirectory: () => false } as any); // a.txt stat in dirSummary
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await treeCommand('/dir');
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('sub/');
    expect(output).toContain('file(s)');
    spy.mockRestore();
  });
});
