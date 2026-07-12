import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs/promises before importing the module under test
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    promises: {
      mkdir: vi.fn().mockResolvedValue(undefined),
      appendFile: vi.fn().mockResolvedValue(undefined),
      readdir: vi.fn().mockResolvedValue([]),
      unlink: vi.fn().mockResolvedValue(undefined),
    }
  };
});

import { promises as fs } from 'fs';
import { createLogger } from '../../../src/utils/logger.js';
import { AuthError, NetworkError } from '../../../src/errors.js';

function lastWritten(): Record<string, unknown> {
  const calls = (fs.appendFile as ReturnType<typeof vi.fn>).mock.calls;
  const lastCall = calls[calls.length - 1];
  return JSON.parse(lastCall[1] as string);
}

async function flushWrites(_log: ReturnType<typeof createLogger>): Promise<void> {
  // Wait a tick for the async writeQueue to flush
  await new Promise(r => setTimeout(r, 0));
}

describe('createLogger', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a Logger with currentLogPath set', () => {
    const log = createLogger('rename', true);
    expect(log.currentLogPath).toMatch(/rename\.log$/);
    expect(log.currentLogPath).toMatch(/\.namewise[/\\]logs[/\\]/);
  });

  it('sets the module-level logger singleton', async () => {
    createLogger('test-singleton');
    const { logger } = await import('../../../src/utils/logger.js');
    expect(logger.currentLogPath).toMatch(/test-singleton\.log$/);
  });
});

describe('Logger.info', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes a JSON line with level info and ts', async () => {
    const log = createLogger('test', true);
    log.info('hello', { file: 'a.pdf' });
    await flushWrites(log);
    const entry = lastWritten();
    expect(entry.level).toBe('info');
    expect(entry.msg).toBe('hello');
    expect(entry.file).toBe('a.pdf');
    expect(typeof entry.ts).toBe('string');
  });
});

describe('Logger write lifecycle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not write anything when disabled', async () => {
    const log = createLogger('test', false);
    log.info('should not be written');
    await flushWrites(log);
    expect(fs.mkdir).not.toHaveBeenCalled();
    expect(fs.appendFile).not.toHaveBeenCalled();
  });

  it('initializes the log directory only once across multiple writes', async () => {
    const log = createLogger('test', true);
    log.info('first');
    log.info('second');
    await flushWrites(log);
    expect(fs.mkdir).toHaveBeenCalledTimes(1);
    expect(fs.appendFile).toHaveBeenCalledTimes(2);
  });

  it('never crashes the host process when appendFile fails', async () => {
    (fs.appendFile as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('disk full'));
    const log = createLogger('test', true);
    expect(() => log.info('doomed write')).not.toThrow();
    await flushWrites(log);
    // A later write still goes through the queue without throwing
    log.info('second write');
    await flushWrites(log);
    expect(fs.appendFile).toHaveBeenCalledTimes(2);
  });
});

describe('Logger.flush', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves only after queued writes reach appendFile', async () => {
    let release!: () => void;
    (fs.appendFile as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () => new Promise<void>(r => { release = r; })
    );
    const log = createLogger('test', true);
    log.info('pending');
    let flushed = false;
    const flushPromise = log.flush().then(() => { flushed = true; });
    await new Promise(r => setTimeout(r, 0));
    expect(flushed).toBe(false);
    release();
    await flushPromise;
    expect(flushed).toBe(true);
    expect(fs.appendFile).toHaveBeenCalledTimes(1);
  });

  it('resolves immediately when nothing was queued', async () => {
    const log = createLogger('test', false);
    await expect(log.flush()).resolves.toBeUndefined();
  });
});

describe('Logger.warn', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes a JSON line with level warn', async () => {
    const log = createLogger('test', true);
    log.warn('something odd', { reason: 'x' });
    await flushWrites(log);
    const entry = lastWritten();
    expect(entry.level).toBe('warn');
    expect(entry.msg).toBe('something odd');
    expect(entry.reason).toBe('x');
  });
});

describe('Logger.error', () => {
  beforeEach(() => vi.clearAllMocks());

  it('logs NamewiseError with name, message, hint, stack', async () => {
    const log = createLogger('test', true);
    const err = new AuthError('bad key');
    log.error(err);
    await flushWrites(log);
    const entry = lastWritten();
    expect(entry.level).toBe('error');
    expect(entry.msg).toBe('AuthError');
    expect(entry.message).toBe('bad key');
    expect(entry.hint).toMatch(/config set apiKey/);
    expect(typeof entry.stack).toBe('string');
  });

  it('logs plain Error with name, message, stack', async () => {
    const log = createLogger('test', true);
    log.error(new Error('oops'));
    await flushWrites(log);
    const entry = lastWritten();
    expect(entry.msg).toBe('Error');
    expect(entry.message).toBe('oops');
    expect(entry.stack).toBeDefined();
  });

  it('logs non-Error values as string', async () => {
    const log = createLogger('test', true);
    log.error('just a string');
    await flushWrites(log);
    const entry = lastWritten();
    expect(entry.msg).toBe('unknown_error');
    expect(entry.value).toBe('just a string');
  });

  it('falls back to "Error" when the error name is undefined', async () => {
    const log = createLogger('test', true);
    log.error({ name: undefined, message: 'nameless failure' });
    await flushWrites(log);
    const entry = lastWritten();
    expect(entry.msg).toBe('Error');
    expect(entry.message).toBe('nameless failure');
  });

  it('includes details when present on the error', async () => {
    const log = createLogger('test', true);
    log.error(new NetworkError('boom', { details: { status: 500, body: 'oops' } }));
    await flushWrites(log);
    const entry = lastWritten();
    expect(entry.details).toEqual({ status: 500, body: 'oops' });
  });

  it('merges extra context', async () => {
    const log = createLogger('test', true);
    log.error(new Error('e'), { file: 'doc.pdf' });
    await flushWrites(log);
    const entry = lastWritten();
    expect(entry.file).toBe('doc.pdf');
  });
});

describe('Logger.session', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes session_start entry', async () => {
    const log = createLogger('rename', true);
    log.session({ command: 'rename', directory: '/tmp/docs', provider: 'claude', dryRun: true });
    await flushWrites(log);
    const entry = lastWritten();
    expect(entry.msg).toBe('session_start');
    expect(entry.command).toBe('rename');
    expect(entry.dryRun).toBe(true);
  });
});

describe('Logger.summary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes session_end entry with totals', async () => {
    const log = createLogger('rename', true);
    log.summary({ total: 5, succeeded: 4, failed: 1, tokenUsage: { inputTokens: 100, outputTokens: 50 }, elapsedMs: 2000 });
    await flushWrites(log);
    const entry = lastWritten();
    expect(entry.msg).toBe('session_end');
    expect(entry.total).toBe(5);
    expect(entry.succeeded).toBe(4);
    expect(entry.failed).toBe(1);
    expect(entry.inputTokens).toBe(100);
    expect(entry.elapsedMs).toBe(2000);
  });
});

describe('auto-prune', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes oldest files when there are 20 or more log files', async () => {
    const logFiles = Array.from({ length: 21 }, (_, i) =>
      `2026-01-${String(i + 1).padStart(2, '0')}T00-00-00-rename.log`
    );
    (fs.readdir as ReturnType<typeof vi.fn>).mockResolvedValue(logFiles);

    const log = createLogger('test', true);
    // Trigger first write to cause init (mkdir + prune)
    log.info('trigger');
    await flushWrites(log);

    expect(fs.unlink).toHaveBeenCalledTimes(2); // 21 - 20 + 1 = 2
    // Oldest two files should be deleted
    const deletedPaths = (fs.unlink as ReturnType<typeof vi.fn>).mock.calls.map((c: any[]) => c[0] as string);
    expect(deletedPaths[0]).toMatch(/2026-01-01/);
    expect(deletedPaths[1]).toMatch(/2026-01-02/);
  });

  it('ignores unlink failures while pruning', async () => {
    const logFiles = Array.from({ length: 21 }, (_, i) =>
      `2026-02-${String(i + 1).padStart(2, '0')}T00-00-00-rename.log`
    );
    (fs.readdir as ReturnType<typeof vi.fn>).mockResolvedValue(logFiles);
    (fs.unlink as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('EPERM'));

    const log = createLogger('test', true);
    log.info('trigger');
    await flushWrites(log);

    // Prune failure must not prevent the write itself
    expect(fs.unlink).toHaveBeenCalledTimes(2);
    expect(fs.appendFile).toHaveBeenCalledTimes(1);
  });

  it('does not prune when fewer than 20 log files exist', async () => {
    (fs.readdir as ReturnType<typeof vi.fn>).mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => `2026-01-${i + 1}-rename.log`)
    );
    const log = createLogger('test', true);
    log.info('trigger');
    await flushWrites(log);
    expect(fs.unlink).not.toHaveBeenCalled();
  });
});
