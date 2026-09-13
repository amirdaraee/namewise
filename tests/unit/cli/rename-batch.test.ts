import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/utils/fs-collect.js', () => ({
  collectFiles: vi.fn(),
  formatBytes: vi.fn((b: number) => `${b}B`)
}));
vi.mock('../../../src/utils/batch-rename.js', () => ({
  applySequence: vi.fn((_i: number, _total: number, prefix?: string) =>
    prefix ? `${prefix}-001` : '001'),
  applyPrefix: vi.fn((stem: string, p: string) => `${p}${stem}`),
  applySuffix: vi.fn((stem: string, s: string) => `${stem}${s}`),
  applyDateStamp: vi.fn((stem: string) => `2024-01-01-${stem}`),
  applyStrip: vi.fn((stem: string, _pattern: string) => stem),
  applyTruncate: vi.fn((stem: string, n: number) => stem.slice(0, n))
}));
vi.mock('../../../src/utils/history.js', () => ({ appendHistory: vi.fn() }));
vi.mock('inquirer', () => ({ default: { prompt: vi.fn() } }));
vi.mock('../../../src/utils/config-loader.js', () => ({ loadConfig: vi.fn().mockResolvedValue({}) }));
vi.mock('../../../src/parsers/factory.js', () => ({ DocumentParserFactory: { create: vi.fn() } }));
vi.mock('../../../src/services/ai-factory.js', () => ({ AIServiceFactory: { create: vi.fn() } }));
vi.mock('../../../src/services/file-renamer.js', () => ({ FileRenamer: vi.fn() }));
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      ...(actual as any).promises,
      stat: vi.fn(),
      rename: vi.fn().mockResolvedValue(undefined),
      readdir: vi.fn().mockResolvedValue([]),
      access: vi.fn().mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }))
    }
  };
});

import { promises as fs } from 'fs';
import { collectFiles } from '../../../src/utils/fs-collect.js';
import { runBatchRenames, renameFiles, runPatternRenamesForTest } from '../../../src/cli/rename.js';

const fakeStat = { isDirectory: () => true, mtime: new Date(), birthtime: new Date() };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fs.stat).mockResolvedValue(fakeStat as any);
});

describe('runBatchRenames()', () => {
  it('prints "No files found." when directory is empty', async () => {
    vi.mocked(collectFiles).mockResolvedValue([]);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await runBatchRenames('/dir', { sequence: true }, false, false);
    expect(spy.mock.calls.map(c => c[0]).join('\n')).toContain('No files found.');
    spy.mockRestore();
  });

  it('renames files using sequence flag', async () => {
    vi.mocked(collectFiles).mockResolvedValue(['/dir/a.txt', '/dir/b.txt']);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await runBatchRenames('/dir', { sequence: true }, false, false);
    expect(fs.rename).toHaveBeenCalledTimes(2);
  });

  it('dry-runs without renaming files', async () => {
    vi.mocked(collectFiles).mockResolvedValue(['/dir/a.txt']);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await runBatchRenames('/dir', { prefix: 'new-' }, true, false);
    expect(fs.rename).not.toHaveBeenCalled();
  });

  // Two files resolving to one target used to be renamed straight over each
  // other with fs.rename, silently destroying the first. --truncate and
  // --strip collide readily on files sharing a prefix.
  it('disambiguates colliding targets with a conflict counter', async () => {
    vi.mocked(collectFiles).mockResolvedValue([
      '/dir/report-january.txt',
      '/dir/report-february.txt',
      '/dir/report-march.txt'
    ]);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await runBatchRenames('/dir', { truncate: 7 }, false, false);
    const targets = vi.mocked(fs.rename).mock.calls.map(c => c[1]);
    expect(targets).toEqual([
      '/dir/report-.txt',
      '/dir/report--2.txt',
      '/dir/report--3.txt'
    ]);
  });

  it('never renames two files onto the same target', async () => {
    vi.mocked(collectFiles).mockResolvedValue([
      '/dir/report-january.txt',
      '/dir/report-february.txt',
      '/dir/report-march.txt'
    ]);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await runBatchRenames('/dir', { truncate: 7 }, false, false);
    const targets = vi.mocked(fs.rename).mock.calls.map(c => c[1]);
    expect(new Set(targets).size).toBe(targets.length);
  });

  it('reserves targets in dry-run too, so the preview matches a real run', async () => {
    vi.mocked(collectFiles).mockResolvedValue([
      '/dir/report-january.txt',
      '/dir/report-february.txt'
    ]);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await runBatchRenames('/dir', { truncate: 7 }, true, false);
    const out = spy.mock.calls.map(c => c[0]).join('\n');
    expect(out).toContain('report--2.txt');
    spy.mockRestore();
  });

  it('skips files whose name does not change', async () => {
    vi.mocked(collectFiles).mockResolvedValue(['/dir/001.txt']);
    // applySequence returns '001' which equals the stem — no rename
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await runBatchRenames('/dir', { sequence: true }, false, false);
    expect(fs.rename).not.toHaveBeenCalled();
  });

  it('passes recursive to collectFiles', async () => {
    vi.mocked(collectFiles).mockResolvedValue([]);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await runBatchRenames('/dir', {}, false, true);
    expect(collectFiles).toHaveBeenCalledWith('/dir', { recursive: true });
  });

  it('renameFiles() routes to runBatchRenames when batch flags present', async () => {
    vi.mocked(collectFiles).mockResolvedValue(['/dir/a.txt']);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await renameFiles('/dir', { sequence: true, dryRun: true });
    // Should have called collectFiles (via runBatchRenames), never invoked AI
    expect(collectFiles).toHaveBeenCalled();
  });

  it('renameFiles() passes truncate option as parsed int', async () => {
    vi.mocked(collectFiles).mockResolvedValue([]);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    // truncate is a string from CLI parsing — renameFiles parses it to int
    await renameFiles('/dir', { truncate: '10' });
    expect(collectFiles).toHaveBeenCalled();
  });

  it('applies suffix flag', async () => {
    vi.mocked(collectFiles).mockResolvedValue(['/dir/file.txt']);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await runBatchRenames('/dir', { suffix: '-backup' }, false, false);
    const { applySuffix } = await import('../../../src/utils/batch-rename.js');
    expect(vi.mocked(applySuffix)).toHaveBeenCalledWith('file', '-backup');
  });

  it('applies strip flag', async () => {
    vi.mocked(collectFiles).mockResolvedValue(['/dir/file.txt']);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await runBatchRenames('/dir', { strip: 'file' }, false, false);
    const { applyStrip } = await import('../../../src/utils/batch-rename.js');
    expect(vi.mocked(applyStrip)).toHaveBeenCalledWith('file', 'file');
  });

  it('applies truncate flag', async () => {
    vi.mocked(collectFiles).mockResolvedValue(['/dir/longfilename.txt']);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await runBatchRenames('/dir', { truncate: 4 }, false, false);
    const { applyTruncate } = await import('../../../src/utils/batch-rename.js');
    expect(vi.mocked(applyTruncate)).toHaveBeenCalledWith('longfilename', 4);
  });

  it('uses mtime when dateStamp is "modified"', async () => {
    const mtime = new Date('2024-09-01');
    vi.mocked(collectFiles).mockResolvedValue(['/dir/doc.txt']);
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false, birthtime: new Date(), mtime } as any);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await runBatchRenames('/dir', { dateStamp: 'modified' }, false, false);
    const { applyDateStamp } = await import('../../../src/utils/batch-rename.js');
    expect(vi.mocked(applyDateStamp)).toHaveBeenCalledWith('doc', mtime, 'YYYY-MM-DD');
  });

  it('uses birthtime when dateStamp is "created"', async () => {
    const birthtime = new Date('2023-03-01');
    const mtime = new Date('2024-06-15');
    vi.mocked(collectFiles).mockResolvedValue(['/dir/report.txt']);
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false, birthtime, mtime } as any);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await runBatchRenames('/dir', { dateStamp: 'created' }, false, false);
    const { applyDateStamp } = await import('../../../src/utils/batch-rename.js');
    expect(vi.mocked(applyDateStamp)).toHaveBeenCalledWith('report', birthtime, 'YYYY-MM-DD');
  });
});

describe('runPatternRenames()', () => {
  const file = (name: string) => ({
    path: `/dir/${name}`,
    name,
    extension: '.txt',
    size: 1
  });
  const config = (patterns: string[], dryRun = false) =>
    ({ patterns, namingConvention: 'kebab-case', dryRun }) as any;

  it('disambiguates colliding targets with a conflict counter', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await runPatternRenamesForTest(
      [file('report-january.txt'), file('report-february.txt')],
      config(['s/january|february//'])
    );
    const targets = vi.mocked(fs.rename).mock.calls.map(c => c[1]);
    expect(targets).toEqual(['/dir/report-.txt', '/dir/report--2.txt']);
  });

  it('never renames two files onto the same target', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await runPatternRenamesForTest(
      [file('report-january.txt'), file('report-february.txt'), file('report-march.txt')],
      config(['s/january|february|march//'])
    );
    const targets = vi.mocked(fs.rename).mock.calls.map(c => c[1]);
    expect(new Set(targets).size).toBe(targets.length);
  });

  it('skips a file when the pattern leaves an empty filename', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await runPatternRenamesForTest([file('report.txt')], config(['s/report//']));
    expect(fs.rename).not.toHaveBeenCalled();
    expect(spy.mock.calls.map(c => c[0]).join('\n')).toContain('empty filename');
    spy.mockRestore();
  });

  it('preserves non-ASCII filenames instead of emptying them', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await runPatternRenamesForTest(
      [{ path: '/dir/Документ.txt', name: 'Документ.txt', extension: '.txt', size: 1 }],
      config(['s/zzznomatch//'])
    );
    // the stem only changes case, so it is renamed rather than emptied to '.txt'
    const targets = vi.mocked(fs.rename).mock.calls.map(c => c[1]);
    expect(targets).toEqual(['/dir/документ.txt']);
  });
});
