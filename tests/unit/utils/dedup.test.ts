import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    createReadStream: vi.fn(),
    promises: {
      ...(actual as any).promises,
      readdir: vi.fn()
    }
  };
});

import { createReadStream, promises as fs } from 'fs';
import { EventEmitter } from 'events';
import { hashFile, findDuplicates } from '../../../src/utils/dedup.js';

function makeStream(data: string): EventEmitter {
  const emitter = new EventEmitter();
  setTimeout(() => {
    emitter.emit('data', Buffer.from(data));
    emitter.emit('end');
  }, 0);
  return emitter;
}

beforeEach(() => vi.clearAllMocks());

describe('hashFile()', () => {
  it('returns a 64-character hex string (SHA-256)', async () => {
    vi.mocked(createReadStream).mockReturnValue(makeStream('hello world') as any);
    const hash = await hashFile('/some/file.txt');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns the same hash for identical content', async () => {
    vi.mocked(createReadStream).mockReturnValue(makeStream('same content') as any);
    const hash1 = await hashFile('/file1.txt');
    vi.mocked(createReadStream).mockReturnValue(makeStream('same content') as any);
    const hash2 = await hashFile('/file2.txt');
    expect(hash1).toBe(hash2);
  });

  it('returns different hashes for different content', async () => {
    vi.mocked(createReadStream).mockReturnValue(makeStream('content A') as any);
    const hash1 = await hashFile('/file1.txt');
    vi.mocked(createReadStream).mockReturnValue(makeStream('content B') as any);
    const hash2 = await hashFile('/file2.txt');
    expect(hash1).not.toBe(hash2);
  });

  it('rejects when stream errors', async () => {
    const emitter = new EventEmitter();
    process.nextTick(() => emitter.emit('error', new Error('stream error')));
    vi.mocked(createReadStream).mockReturnValue(emitter as any);
    await expect(hashFile('/bad/file.txt')).rejects.toThrow('stream error');
  });
});

describe('findDuplicates()', () => {
  it('returns empty map when no duplicates exist', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: 'a.txt', isDirectory: () => false, isFile: () => true } as any,
      { name: 'b.txt', isDirectory: () => false, isFile: () => true } as any
    ]);
    vi.mocked(createReadStream)
      .mockReturnValueOnce(makeStream('content A') as any)
      .mockReturnValueOnce(makeStream('content B') as any);

    const result = await findDuplicates('/dir');
    expect(result.size).toBe(0);
  });

  it('returns a group for files with identical content', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: 'a.txt', isDirectory: () => false, isFile: () => true } as any,
      { name: 'b.txt', isDirectory: () => false, isFile: () => true } as any
    ]);
    vi.mocked(createReadStream)
      .mockReturnValueOnce(makeStream('same') as any)
      .mockReturnValueOnce(makeStream('same') as any);

    const result = await findDuplicates('/dir');
    expect(result.size).toBe(1);
    const [paths] = [...result.values()];
    expect(paths).toHaveLength(2);
  });

  it('recurses into subdirectories when recursive is true', async () => {
    vi.mocked(fs.readdir)
      .mockResolvedValueOnce([
        { name: 'top.txt', isDirectory: () => false, isFile: () => true } as any,
        { name: 'sub', isDirectory: () => true, isFile: () => false } as any
      ])
      .mockResolvedValueOnce([
        { name: 'nested.txt', isDirectory: () => false, isFile: () => true } as any
      ]);
    vi.mocked(createReadStream)
      .mockReturnValueOnce(makeStream('same') as any)
      .mockReturnValueOnce(makeStream('same') as any);

    const result = await findDuplicates('/dir', true);
    expect(result.size).toBe(1);
    const [paths] = [...result.values()];
    expect(paths).toHaveLength(2);
    expect(paths).toContain('/dir/top.txt');
    expect(paths).toContain('/dir/sub/nested.txt');
  });
});
