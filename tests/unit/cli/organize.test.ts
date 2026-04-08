import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/utils/organize.js', () => ({ computeOrganizeMappings: vi.fn() }));
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      ...(actual as any).promises,
      stat: vi.fn(),
      mkdir: vi.fn().mockResolvedValue(undefined),
      rename: vi.fn().mockResolvedValue(undefined)
    }
  };
});
vi.mock('../../../src/utils/history.js', () => ({ appendHistory: vi.fn() }));

import { promises as fs } from 'fs';
import { computeOrganizeMappings } from '../../../src/utils/organize.js';
import { organizeFiles } from '../../../src/cli/organize.js';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
  vi.mocked(computeOrganizeMappings).mockResolvedValue([]);
});

describe('organizeFiles()', () => {
  it('throws when path is not a directory', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false } as any);
    await expect(organizeFiles('/f', { by: 'ext' })).rejects.toThrow('is not a directory');
  });

  it('prints "Nothing to organize." when no mappings', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await organizeFiles('/dir', { by: 'ext' });
    expect(spy.mock.calls.map(c => c[0]).join('\n')).toContain('Nothing to organize.');
    spy.mockRestore();
  });

  it('dry-runs without moving files', async () => {
    vi.mocked(computeOrganizeMappings).mockResolvedValue([
      { sourcePath: '/dir/a.pdf', destPath: '/dir/pdf/a.pdf', reason: 'pdf' }
    ]);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await organizeFiles('/dir', { by: 'ext', dryRun: true });
    expect(fs.rename).not.toHaveBeenCalled();
    expect(fs.mkdir).not.toHaveBeenCalled();
  });

  it('moves files and creates destination dirs', async () => {
    vi.mocked(computeOrganizeMappings).mockResolvedValue([
      { sourcePath: '/dir/a.pdf', destPath: '/dir/pdf/a.pdf', reason: 'pdf' }
    ]);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await organizeFiles('/dir', { by: 'ext' });
    expect(fs.mkdir).toHaveBeenCalledWith('/dir/pdf', { recursive: true });
    expect(fs.rename).toHaveBeenCalledWith('/dir/a.pdf', '/dir/pdf/a.pdf');
  });

  it('defaults to "ext" when no by option provided', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await organizeFiles('/dir', {});
    expect(computeOrganizeMappings).toHaveBeenCalledWith('/dir', 'ext', false);
  });

  it('reports moved count', async () => {
    vi.mocked(computeOrganizeMappings).mockResolvedValue([
      { sourcePath: '/dir/a.pdf', destPath: '/dir/pdf/a.pdf', reason: 'pdf' },
      { sourcePath: '/dir/b.txt', destPath: '/dir/txt/b.txt', reason: 'txt' }
    ]);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await organizeFiles('/dir', { by: 'ext' });
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('2 file(s)');
    spy.mockRestore();
  });
});
