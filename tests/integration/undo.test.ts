import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { createTempDir } from './helpers/harness.js';

// Mock the history module so tests don't touch ~/.namewise/history.json
vi.mock('../../src/utils/history.js', () => ({
  readHistory: vi.fn(),
  appendHistory: vi.fn().mockResolvedValue(undefined)
}));

import { undoRename } from '../../src/cli/undo.js';
import { readHistory, appendHistory } from '../../src/utils/history.js';

describe('undoRename() — integration', () => {
  let tempDir: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ dir: tempDir, cleanup } = await createTempDir());
    vi.mocked(readHistory).mockResolvedValue([]);
    vi.mocked(appendHistory).mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await cleanup();
    vi.clearAllMocks();
  });

  it('restores renamed files to their original paths', async () => {
    // Create the "already-renamed" file on disk (simulates a previous rename)
    const newPath = path.join(tempDir, 'new-name.txt');
    const originalPath = path.join(tempDir, 'old-name.txt');
    await fs.writeFile(newPath, 'file content');

    vi.mocked(readHistory).mockResolvedValue([
      {
        id: 'session-1',
        timestamp: new Date().toISOString(),
        directory: tempDir,
        dryRun: false,
        renames: [{ originalPath, newPath }]
      }
    ]);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await undoRename('session-1');
    consoleSpy.mockRestore();

    // new-name.txt should be gone; old-name.txt should exist
    await expect(fs.access(originalPath)).resolves.toBeUndefined();
    await expect(fs.access(newPath)).rejects.toThrow();
  });

  it('undoes the most recent non-dry-run session when no ID supplied', async () => {
    const newPath = path.join(tempDir, 'renamed.txt');
    const originalPath = path.join(tempDir, 'original.txt');
    await fs.writeFile(newPath, 'content');

    vi.mocked(readHistory).mockResolvedValue([
      {
        id: 'dry-session',
        timestamp: '2024-01-01T00:00:00Z',
        directory: tempDir,
        dryRun: true,
        renames: []
      },
      {
        id: 'real-session',
        timestamp: '2024-01-02T00:00:00Z',
        directory: tempDir,
        dryRun: false,
        renames: [{ originalPath, newPath }]
      }
    ]);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await undoRename();
    consoleSpy.mockRestore();

    await expect(fs.access(originalPath)).resolves.toBeUndefined();
  });

  it('appends an inverse session to history after undo', async () => {
    const newPath = path.join(tempDir, 'b.txt');
    const originalPath = path.join(tempDir, 'a.txt');
    await fs.writeFile(newPath, 'content');

    vi.mocked(readHistory).mockResolvedValue([
      {
        id: 'session-abc',
        timestamp: '2024-01-01T00:00:00Z',
        directory: tempDir,
        dryRun: false,
        renames: [{ originalPath, newPath }]
      }
    ]);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await undoRename('session-abc');
    consoleSpy.mockRestore();

    expect(appendHistory).toHaveBeenCalledOnce();
    const appended = vi.mocked(appendHistory).mock.calls[0][0];
    expect(appended.renames).toEqual([{ originalPath: newPath, newPath: originalPath }]);
  });

  it('warns but does not error when a file to restore is missing', async () => {
    const nonExistentNew = path.join(tempDir, 'gone.txt');
    const originalPath = path.join(tempDir, 'back.txt');

    vi.mocked(readHistory).mockResolvedValue([
      {
        id: 'session-missing',
        timestamp: new Date().toISOString(),
        directory: tempDir,
        dryRun: false,
        renames: [{ originalPath, newPath: nonExistentNew }]
      }
    ]);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(undoRename('session-missing')).resolves.toBeUndefined();

    warnSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('lists recent sessions with --list', async () => {
    vi.mocked(readHistory).mockResolvedValue([
      { id: 's1', timestamp: '2024-01-01T00:00:00Z', directory: '/a', dryRun: false, renames: [] },
      { id: 's2', timestamp: '2024-01-02T00:00:00Z', directory: '/b', dryRun: true, renames: [] }
    ]);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await undoRename(undefined, { list: true });

    const output = consoleSpy.mock.calls.map(c => c.join(' ')).join('\n');
    expect(output).toContain('s1');
    expect(output).toContain('s2');
    consoleSpy.mockRestore();
  });

  it('undoes all sessions with --all when only one session (no prompt)', async () => {
    const newPath = path.join(tempDir, 'new-name.txt');
    const originalPath = path.join(tempDir, 'old-name.txt');
    await fs.writeFile(newPath, 'content');

    vi.mocked(readHistory).mockResolvedValue([{
      id: 'sess-1',
      timestamp: new Date().toISOString(),
      directory: tempDir,
      dryRun: false,
      renames: [{ originalPath, newPath }]
    }]);

    vi.spyOn(console, 'log').mockImplementation(() => {});
    await undoRename(undefined, { all: true });

    await expect(fs.access(originalPath)).resolves.toBeUndefined();
    await expect(fs.access(newPath)).rejects.toThrow();
  });
});
