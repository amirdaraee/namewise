import { describe, it, expect, beforeEach, vi } from 'vitest';
import os from 'os';
import path from 'path';

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      ...(actual as any).promises,
      mkdir: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn(),
      writeFile: vi.fn().mockResolvedValue(undefined)
    }
  };
});

import { promises as fs } from 'fs';
import { appendHistory, readHistory, HistoryEntry } from '../../../src/utils/history.js';

const HISTORY_FILE = path.join(os.homedir(), '.namewise', 'history.json');

const makeEntry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id: '2026-04-02T10:00:00.000Z',
  timestamp: '2026-04-02T10:00:00.000Z',
  directory: '/some/dir',
  dryRun: false,
  renames: [{ originalPath: '/some/dir/old.pdf', newPath: '/some/dir/new.pdf' }],
  ...overrides
});

describe('readHistory()', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty array when history file does not exist', async () => {
    vi.mocked(fs.readFile).mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }));
    expect(await readHistory()).toEqual([]);
  });

  it('returns empty array when history file is corrupt JSON', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('{ bad json' as any);
    expect(await readHistory()).toEqual([]);
  });

  it('returns parsed history when file is valid', async () => {
    const entries = [makeEntry()];
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(entries) as any);
    expect(await readHistory()).toEqual(entries);
  });
});

describe('appendHistory()', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates history directory and file when they do not exist', async () => {
    vi.mocked(fs.readFile).mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }));
    await appendHistory(makeEntry());
    expect(fs.mkdir).toHaveBeenCalledWith(path.join(os.homedir(), '.namewise'), { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledWith(
      HISTORY_FILE,
      expect.stringContaining('"id": "2026-04-02T10:00:00.000Z"'),
      'utf-8'
    );
  });

  it('appends to existing history', async () => {
    const existing = [makeEntry({ id: '2026-04-01T10:00:00.000Z' })];
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existing) as any);
    const newEntry = makeEntry({ id: '2026-04-02T10:00:00.000Z' });
    await appendHistory(newEntry);
    const written = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0][1] as string) as HistoryEntry[];
    expect(written).toHaveLength(2);
    expect(written[1].id).toBe('2026-04-02T10:00:00.000Z');
  });

  it('starts fresh if existing history is corrupt', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('{ bad json' as any);
    await appendHistory(makeEntry());
    const written = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0][1] as string) as HistoryEntry[];
    expect(written).toHaveLength(1);
  });

  it('should persist tokenUsage when provided', async () => {
    vi.mocked(fs.readFile).mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }));
    const entry = makeEntry({
      id: '2026-01-01T00:00:00.000Z',
      tokenUsage: { inputTokens: 500, outputTokens: 42 }
    });
    await appendHistory(entry);
    const written = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0][1] as string) as HistoryEntry[];
    const saved = written.find(h => h.id === entry.id);
    expect(saved?.tokenUsage).toEqual({ inputTokens: 500, outputTokens: 42 });
  });

  it('should work without tokenUsage (backwards compatibility)', async () => {
    vi.mocked(fs.readFile).mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }));
    const entry = makeEntry({
      id: '2026-01-02T00:00:00.000Z'
      // tokenUsage intentionally omitted
    });
    await appendHistory(entry);
    const written = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0][1] as string) as HistoryEntry[];
    const saved = written.find(h => h.id === entry.id);
    expect(saved?.tokenUsage).toBeUndefined();
  });
});
