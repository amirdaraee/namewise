import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/utils/history.js', () => ({
  readHistory: vi.fn(),
  appendHistory: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      ...(actual as any).promises,
      access: vi.fn(),
      rename: vi.fn().mockResolvedValue(undefined)
    }
  };
});

import { promises as fs } from 'fs';
import { readHistory, appendHistory } from '../../../src/utils/history.js';
import { undoRename } from '../../../src/cli/undo.js';

const mockReadHistory = vi.mocked(readHistory);

const session = {
  id: '2026-04-02T10:00:00.000Z',
  timestamp: '2026-04-02T10:00:00.000Z',
  directory: '/some/dir',
  dryRun: false,
  renames: [
    { originalPath: '/some/dir/old.pdf', newPath: '/some/dir/new-name.pdf' }
  ]
};

describe('undoRename()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.access).mockResolvedValue(undefined);
  });

  describe('--list', () => {
    it('prints "No rename history found." when history is empty', async () => {
      mockReadHistory.mockResolvedValue([]);
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await undoRename(undefined, { list: true });
      expect(spy).toHaveBeenCalledWith('No rename history found.');
      spy.mockRestore();
    });

    it('prints recent sessions with IDs', async () => {
      mockReadHistory.mockResolvedValue([session]);
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await undoRename(undefined, { list: true });
      expect(spy).toHaveBeenCalledWith(expect.stringContaining(session.id));
      spy.mockRestore();
    });

    it('marks dry-run sessions with [dry-run] label', async () => {
      mockReadHistory.mockResolvedValue([{ ...session, dryRun: true }]);
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await undoRename(undefined, { list: true });
      const allCalls = spy.mock.calls.map(c => c[0]).join(' ');
      expect(allCalls).toContain('[dry-run]');
      spy.mockRestore();
    });
  });

  describe('undo by session ID', () => {
    it('throws when session ID is not found', async () => {
      mockReadHistory.mockResolvedValue([session]);
      await expect(undoRename('nonexistent-id')).rejects.toThrow('Session not found: nonexistent-id');
    });

    it('restores files by calling fs.rename in reverse', async () => {
      mockReadHistory.mockResolvedValue([session]);
      vi.spyOn(console, 'log').mockImplementation(() => {});
      await undoRename(session.id);
      expect(fs.rename).toHaveBeenCalledWith('/some/dir/new-name.pdf', '/some/dir/old.pdf');
    });

    it('appends an inverse session to history after undo', async () => {
      mockReadHistory.mockResolvedValue([session]);
      vi.spyOn(console, 'log').mockImplementation(() => {});
      await undoRename(session.id);
      expect(appendHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          renames: [{ originalPath: '/some/dir/new-name.pdf', newPath: '/some/dir/old.pdf' }]
        })
      );
    });
  });

  describe('undo most recent', () => {
    it('skips dry-run sessions when finding most recent', async () => {
      const drySession = { ...session, id: 'dry-id', dryRun: true };
      const realSession = { ...session, id: 'real-id', dryRun: false };
      mockReadHistory.mockResolvedValue([drySession, realSession]);
      vi.spyOn(console, 'log').mockImplementation(() => {});
      await undoRename();
      expect(fs.rename).toHaveBeenCalledWith('/some/dir/new-name.pdf', '/some/dir/old.pdf');
    });

    it('warns and skips when file to restore is not found', async () => {
      mockReadHistory.mockResolvedValue([session]);
      vi.mocked(fs.access).mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }));
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(console, 'log').mockImplementation(() => {});
      await undoRename();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Skipped'));
      expect(fs.rename).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('prints message when no undo-able sessions exist', async () => {
      mockReadHistory.mockResolvedValue([{ ...session, dryRun: true }]);
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await undoRename();
      expect(spy).toHaveBeenCalledWith('No undo-able rename sessions found.');
      spy.mockRestore();
    });
  });
});
