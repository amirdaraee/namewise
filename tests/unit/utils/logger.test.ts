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
import { createLogger, logger as defaultLogger } from '../../../src/utils/logger.js';
import { AuthError } from '../../../src/errors.js';

function lastWritten(): Record<string, unknown> {
  const calls = (fs.appendFile as ReturnType<typeof vi.fn>).mock.calls;
  const lastCall = calls[calls.length - 1];
  return JSON.parse(lastCall[1] as string);
}

async function flushWrites(log: ReturnType<typeof createLogger>): Promise<void> {
  // Wait a tick for the async writeQueue to flush
  await new Promise(r => setTimeout(r, 0));
}

describe('createLogger', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a Logger with currentLogPath set', () => {
    const log = createLogger('rename');
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
    const log = createLogger('test');
    log.info('hello', { file: 'a.pdf' });
    await flushWrites(log);
    const entry = lastWritten();
    expect(entry.level).toBe('info');
    expect(entry.msg).toBe('hello');
    expect(entry.file).toBe('a.pdf');
    expect(typeof entry.ts).toBe('string');
  });
});

describe('Logger.warn', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes a JSON line with level warn', async () => {
    const log = createLogger('test');
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
    const log = createLogger('test');
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
    const log = createLogger('test');
    log.error(new Error('oops'));
    await flushWrites(log);
    const entry = lastWritten();
    expect(entry.msg).toBe('Error');
    expect(entry.message).toBe('oops');
    expect(entry.stack).toBeDefined();
  });

  it('logs non-Error values as string', async () => {
    const log = createLogger('test');
    log.error('just a string');
    await flushWrites(log);
    const entry = lastWritten();
    expect(entry.msg).toBe('unknown_error');
    expect(entry.value).toBe('just a string');
  });

  it('merges extra context', async () => {
    const log = createLogger('test');
    log.error(new Error('e'), { file: 'doc.pdf' });
    await flushWrites(log);
    const entry = lastWritten();
    expect(entry.file).toBe('doc.pdf');
  });
});

describe('Logger.session', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes session_start entry', async () => {
    const log = createLogger('rename');
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
    const log = createLogger('rename');
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

    const log = createLogger('test');
    // Trigger first write to cause init (mkdir + prune)
    log.info('trigger');
    await flushWrites(log);

    expect(fs.unlink).toHaveBeenCalledTimes(2); // 21 - 20 + 1 = 2
    // Oldest two files should be deleted
    const deletedPaths = (fs.unlink as ReturnType<typeof vi.fn>).mock.calls.map((c: any[]) => c[0] as string);
    expect(deletedPaths[0]).toMatch(/2026-01-01/);
    expect(deletedPaths[1]).toMatch(/2026-01-02/);
  });

  it('does not prune when fewer than 20 log files exist', async () => {
    (fs.readdir as ReturnType<typeof vi.fn>).mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => `2026-01-${i + 1}-rename.log`)
    );
    const log = createLogger('test');
    log.info('trigger');
    await flushWrites(log);
    expect(fs.unlink).not.toHaveBeenCalled();
  });
});
