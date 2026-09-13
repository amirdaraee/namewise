import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      ...(actual as any).promises,
      access: vi.fn(),
      stat: vi.fn()
    }
  };
});

import { promises as fs } from 'fs';
import path from 'path';
import { resolveTargetPath } from '../../../src/utils/resolve-target.js';

const enoent = () => Object.assign(new Error('missing'), { code: 'ENOENT' });
// resolveTargetPath builds candidates with path.join, so expectations must too
const p = (name: string) => path.join('/dir', name);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolveTargetPath()', () => {
  it('returns the desired path when nothing claims it', async () => {
    vi.mocked(fs.access).mockRejectedValue(enoent());
    const claimed = new Set<string>();
    await expect(resolveTargetPath(p('a.txt'), claimed)).resolves.toBe(p('a.txt'));
  });

  it('claims the path it returns so the next caller cannot take it', async () => {
    vi.mocked(fs.access).mockRejectedValue(enoent());
    const claimed = new Set<string>();
    await resolveTargetPath(p('a.txt'), claimed);
    expect(claimed.has(p('a.txt'))).toBe(true);
  });

  it('skips a candidate already claimed in this batch', async () => {
    vi.mocked(fs.access).mockRejectedValue(enoent());
    const claimed = new Set<string>([p('a.txt')]);
    await expect(resolveTargetPath(p('a.txt'), claimed)).resolves.toBe(p('a-2.txt'));
  });

  it('skips a candidate that already exists on disk', async () => {
    vi.mocked(fs.access).mockImplementation(async (target) => {
      if (String(target) === p('a.txt')) return;
      throw enoent();
    });
    await expect(resolveTargetPath(p('a.txt'), new Set())).resolves.toBe(p('a-2.txt'));
  });

  it('keeps counting past an occupied counter', async () => {
    vi.mocked(fs.access).mockImplementation(async (target) => {
      if (String(target) === p('a.txt') || String(target) === p('a-2.txt')) return;
      throw enoent();
    });
    await expect(resolveTargetPath(p('a.txt'), new Set())).resolves.toBe(p('a-3.txt'));
  });

  it('throws when every candidate through -99 is taken', async () => {
    vi.mocked(fs.access).mockResolvedValue(undefined as never);
    await expect(resolveTargetPath(p('a.txt'), new Set())).rejects.toThrow(
      /Could not find an available filename for: a\.txt \(tried -2 through -99\)/
    );
  });

  // macOS and Windows filesystems are case-insensitive, so fs.access on the
  // lowercased target resolves to the source file itself. Treating that as a
  // collision bumped every case-only rename to -2.
  it('does not bump a case-only rename when the match is the source file', async () => {
    vi.mocked(fs.access).mockResolvedValue(undefined as never);
    vi.mocked(fs.stat).mockResolvedValue({ dev: 1, ino: 42 } as never);
    await expect(
      resolveTargetPath(p('документ.txt'), new Set(), p('Документ.txt'))
    ).resolves.toBe(p('документ.txt'));
  });

  it('still bumps when the existing file is a different file', async () => {
    vi.mocked(fs.access).mockImplementation(async (target) => {
      if (String(target) === p('a.txt')) return;
      throw enoent();
    });
    vi.mocked(fs.stat).mockImplementation(async (target) =>
      (String(target) === p('a.txt') ? { dev: 1, ino: 99 } : { dev: 1, ino: 1 }) as never
    );
    await expect(resolveTargetPath(p('a.txt'), new Set(), p('b.txt'))).resolves.toBe(p('a-2.txt'));
  });

  it('bumps when the occupying file cannot be stat-ed', async () => {
    vi.mocked(fs.access).mockImplementation(async (target) => {
      if (String(target) === p('a.txt')) return;
      throw enoent();
    });
    vi.mocked(fs.stat).mockRejectedValue(enoent());
    await expect(resolveTargetPath(p('a.txt'), new Set(), p('b.txt'))).resolves.toBe(p('a-2.txt'));
  });

  it('preserves the extension when disambiguating', async () => {
    vi.mocked(fs.access).mockRejectedValue(enoent());
    const claimed = new Set<string>([p('report.tar.gz')]);
    await expect(resolveTargetPath(p('report.tar.gz'), claimed)).resolves.toBe(p('report.tar-2.gz'));
  });
});
