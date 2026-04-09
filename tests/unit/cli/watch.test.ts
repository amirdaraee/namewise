import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';

// ─── Chokidar mock ────────────────────────────────────────────────────────────
// Use vi.hoisted() so the variables are initialised before the hoisted vi.mock() factory runs
const { mockWatcherOn, mockWatcherClose, mockWatcher, mockChokidarWatch } = vi.hoisted(() => {
  const mockWatcherOn = vi.fn();
  const mockWatcherClose = vi.fn().mockResolvedValue(undefined);
  const mockWatcher: any = { on: mockWatcherOn, close: mockWatcherClose };
  // Make on() chainable (chokidar uses method-chaining)
  mockWatcherOn.mockReturnValue(mockWatcher);
  const mockChokidarWatch = vi.fn().mockReturnValue(mockWatcher);
  return { mockWatcherOn, mockWatcherClose, mockWatcher, mockChokidarWatch };
});

vi.mock('chokidar', () => ({
  default: {
    watch: mockChokidarWatch
  }
}));

// ─── fs mock ─────────────────────────────────────────────────────────────────
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      stat: vi.fn(),
      readdir: vi.fn(),
      rename: vi.fn().mockResolvedValue(undefined)
    }
  };
});

// ─── Parser factory mock ──────────────────────────────────────────────────────
vi.mock('../../../src/parsers/factory.js', () => ({
  DocumentParserFactory: vi.fn().mockImplementation(() => ({
    getSupportedExtensions: vi.fn().mockReturnValue(['.pdf', '.docx', '.txt']),
    getParser: vi.fn()
  }))
}));

// ─── AI service factory mock ──────────────────────────────────────────────────
vi.mock('../../../src/services/ai-factory.js', () => ({
  AIServiceFactory: {
    create: vi.fn().mockReturnValue({
      generateFileName: vi.fn().mockResolvedValue('renamed-file')
    })
  }
}));

// ─── Config loader mock ───────────────────────────────────────────────────────
vi.mock('../../../src/utils/config-loader.js', () => ({
  loadConfig: vi.fn().mockResolvedValue({})
}));

// ─── History mock ─────────────────────────────────────────────────────────────
vi.mock('../../../src/utils/history.js', () => ({
  appendHistory: vi.fn().mockResolvedValue(undefined)
}));

// ─── FileRenamer mock ─────────────────────────────────────────────────────────
vi.mock('../../../src/services/file-renamer.js', () => ({
  FileRenamer: vi.fn().mockImplementation(() => ({
    renameFiles: vi.fn().mockResolvedValue({
      results: [{
        originalPath: '/watch/dir/document.pdf',
        newPath: '/watch/dir/renamed.pdf',
        suggestedName: 'renamed.pdf',
        success: true
      }],
      tokenUsage: { inputTokens: 100, outputTokens: 10 }
    })
  }))
}));

// ─── Deferred import after all mocks are set up ───────────────────────────────
import { watchDirectory } from '../../../src/cli/watch.js';
import { promises as fs } from 'fs';
import { DocumentParserFactory } from '../../../src/parsers/factory.js';
import { AIServiceFactory } from '../../../src/services/ai-factory.js';
import { FileRenamer } from '../../../src/services/file-renamer.js';
import { appendHistory } from '../../../src/utils/history.js';
import { loadConfig } from '../../../src/utils/config-loader.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Capture the SIGINT/SIGTERM handlers that watchDirectory registers, so that
 * tests can trigger shutdown without emitting global process signals that would
 * interfere with other tests.
 */
function captureSignalHandlers(): {
  getHandler: (signal: 'SIGINT' | 'SIGTERM') => ((...args: any[]) => void) | undefined;
  restore: () => void;
} {
  const captured: Partial<Record<'SIGINT' | 'SIGTERM', (...args: any[]) => void>> = {};
  const origOnce = process.once.bind(process);
  const onceSpy = vi.spyOn(process, 'once').mockImplementation((event: any, handler: any) => {
    if (event === 'SIGINT' || event === 'SIGTERM') {
      captured[event as 'SIGINT' | 'SIGTERM'] = handler;
    } else {
      origOnce(event, handler);
    }
    return process;
  });
  return {
    getHandler: (signal) => captured[signal],
    restore: () => onceSpy.mockRestore()
  };
}

describe('watchDirectory()', () => {
  const mockStat = vi.mocked(fs.stat);

  const defaultOptions = {
    provider: 'claude',
    apiKey: 'test-api-key',
    dryRun: false,
    maxSize: '10',
    case: 'kebab-case',
    template: 'general',
    name: undefined,
    date: 'none',
    baseUrl: undefined,
    model: undefined,
    recursive: false,
    depth: undefined,
    concurrency: '3',
    output: undefined,
    pattern: [] as string[]
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Re-set chokidar mocks after clearAllMocks
    mockWatcherOn.mockReturnValue(mockWatcher);
    mockWatcherClose.mockResolvedValue(undefined);
    mockChokidarWatch.mockReturnValue(mockWatcher);

    // Re-set fs.stat mock
    mockStat.mockResolvedValue({
      isDirectory: () => true,
      size: 1024,
      birthtime: new Date(),
      mtime: new Date(),
      atime: new Date()
    } as any);

    // Re-set config loader mock
    vi.mocked(loadConfig).mockResolvedValue({});

    // Re-set DocumentParserFactory mock
    vi.mocked(DocumentParserFactory).mockImplementation(() => ({
      getSupportedExtensions: vi.fn().mockReturnValue(['.pdf', '.docx', '.txt']),
      getParser: vi.fn()
    }) as any);

    // Re-set FileRenamer mock
    vi.mocked(FileRenamer).mockImplementation(() => ({
      renameFiles: vi.fn().mockResolvedValue({
        results: [{
          originalPath: '/watch/dir/document.pdf',
          newPath: '/watch/dir/renamed.pdf',
          suggestedName: 'renamed.pdf',
          success: true
        }],
        tokenUsage: { inputTokens: 100, outputTokens: 10 }
      })
    }) as any);

    // Re-set appendHistory mock
    vi.mocked(appendHistory).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Directory validation ──────────────────────────────────────────────────

  describe('directory validation', () => {
    it('should throw when the directory does not exist', async () => {
      const error = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      mockStat.mockRejectedValueOnce(error);

      await expect(watchDirectory('/nonexistent', defaultOptions)).rejects.toThrow('ENOENT');
    });

    it('should throw when the path is not a directory', async () => {
      mockStat.mockResolvedValueOnce({ isDirectory: () => false } as any);

      await expect(watchDirectory('/some/file.txt', defaultOptions))
        .rejects.toThrow('is not a directory');
    });
  });

  // ─── Chokidar watcher setup ────────────────────────────────────────────────

  describe('chokidar watcher setup', () => {
    it('calls chokidar.watch with the resolved directory path', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { getHandler, restore } = captureSignalHandlers();

      const watchPromise = watchDirectory('/watch/dir', defaultOptions);

      // Allow microtasks/promises inside watchDirectory to settle
      await new Promise(resolve => setTimeout(resolve, 10));

      // Trigger shutdown via captured handler
      getHandler('SIGINT')?.();
      await watchPromise;

      const chokidar = await import('chokidar');
      expect(chokidar.default.watch).toHaveBeenCalledWith(
        path.resolve('/watch/dir'),
        expect.objectContaining({ ignoreInitial: true })
      );

      restore();
      consoleSpy.mockRestore();
    });

    it('passes ignored pattern that filters out unsupported extensions', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { getHandler, restore } = captureSignalHandlers();

      const watchPromise = watchDirectory('/watch/dir', defaultOptions);
      await new Promise(resolve => setTimeout(resolve, 10));
      getHandler('SIGINT')?.();
      await watchPromise;

      const chokidar = await import('chokidar');
      const callOptions = vi.mocked(chokidar.default.watch).mock.calls[0]?.[1] as any;
      expect(callOptions).toHaveProperty('ignored');

      const ignoredFn = callOptions.ignored;
      // Unsupported extension → ignored
      expect(ignoredFn('/watch/dir/image.jpg')).toBe(true);
      // Supported extensions → NOT ignored
      expect(ignoredFn('/watch/dir/document.pdf')).toBe(false);
      expect(ignoredFn('/watch/dir/notes.txt')).toBe(false);
      // No extension (directory) → NOT ignored so chokidar can recurse
      expect(ignoredFn('/watch/dir/somedir')).toBe(false);

      restore();
      consoleSpy.mockRestore();
    });
  });

  // ─── Add event handling ────────────────────────────────────────────────────

  describe('add event handling', () => {
    /** Helper: start watcher, capture the 'add' handler, then shut down */
    async function withAddHandler(
      opts: Record<string, any>,
      callback: (addHandler: (filePath: string) => Promise<void>) => Promise<void>
    ) {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleErrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { getHandler, restore } = captureSignalHandlers();

      let addHandler: ((filePath: string) => Promise<void>) | undefined;
      mockWatcherOn.mockImplementation((event: string, handler: any) => {
        if (event === 'add') addHandler = handler;
        return mockWatcher;
      });

      const watchPromise = watchDirectory('/watch/dir', opts);
      await new Promise(resolve => setTimeout(resolve, 10));

      await callback(addHandler ?? (async () => {}));

      getHandler('SIGINT')?.();
      await watchPromise;

      restore();
      consoleSpy.mockRestore();
      consoleErrSpy.mockRestore();
    }

    it('processes a newly added supported file through the rename pipeline', async () => {
      await withAddHandler(defaultOptions, async (addHandler) => {
        await addHandler('/watch/dir/document.pdf');
      });

      // FileRenamer should have been constructed and renameFiles called
      expect(vi.mocked(FileRenamer)).toHaveBeenCalled();
    });

    it('logs the detected file path when a new file is added', async () => {
      const logCalls: string[] = [];
      vi.spyOn(console, 'log').mockImplementation((...args: any[]) => {
        logCalls.push(args.join(' '));
      });

      const { getHandler, restore } = captureSignalHandlers();

      let addHandler: ((filePath: string) => Promise<void>) | undefined;
      mockWatcherOn.mockImplementation((event: string, handler: any) => {
        if (event === 'add') addHandler = handler;
        return mockWatcher;
      });

      const watchPromise = watchDirectory('/watch/dir', defaultOptions);
      await new Promise(resolve => setTimeout(resolve, 10));

      if (addHandler) await addHandler('/watch/dir/document.pdf');

      getHandler('SIGINT')?.();
      await watchPromise;
      restore();

      expect(logCalls.join('\n')).toContain('document.pdf');
    });

    it('logs rename result when a file is successfully renamed', async () => {
      const logCalls: string[] = [];
      vi.spyOn(console, 'log').mockImplementation((...args: any[]) => {
        logCalls.push(args.join(' '));
      });

      const { getHandler, restore } = captureSignalHandlers();

      let addHandler: ((filePath: string) => Promise<void>) | undefined;
      mockWatcherOn.mockImplementation((event: string, handler: any) => {
        if (event === 'add') addHandler = handler;
        return mockWatcher;
      });

      const watchPromise = watchDirectory('/watch/dir', defaultOptions);
      await new Promise(resolve => setTimeout(resolve, 10));

      if (addHandler) await addHandler('/watch/dir/document.pdf');

      getHandler('SIGINT')?.();
      await watchPromise;
      restore();

      expect(logCalls.join('\n')).toContain('renamed.pdf');
    });

    it('logs "no rename needed" when original and new path are the same', async () => {
      vi.mocked(FileRenamer).mockImplementationOnce(() => ({
        renameFiles: vi.fn().mockResolvedValue({
          results: [{
            originalPath: '/watch/dir/document.pdf',
            newPath: '/watch/dir/document.pdf',
            suggestedName: 'document.pdf',
            success: true
          }],
          tokenUsage: { inputTokens: undefined, outputTokens: undefined }
        })
      }) as any);

      const logCalls: string[] = [];
      vi.spyOn(console, 'log').mockImplementation((...args: any[]) => {
        logCalls.push(args.join(' '));
      });

      const { getHandler, restore } = captureSignalHandlers();

      let addHandler: ((filePath: string) => Promise<void>) | undefined;
      mockWatcherOn.mockImplementation((event: string, handler: any) => {
        if (event === 'add') addHandler = handler;
        return mockWatcher;
      });

      const watchPromise = watchDirectory('/watch/dir', defaultOptions);
      await new Promise(resolve => setTimeout(resolve, 10));

      if (addHandler) await addHandler('/watch/dir/document.pdf');

      getHandler('SIGINT')?.();
      await watchPromise;
      restore();

      expect(logCalls.join('\n')).toMatch(/no rename needed/i);
    });

    it('logs an error when the rename pipeline throws', async () => {
      vi.mocked(FileRenamer).mockImplementationOnce(() => ({
        renameFiles: vi.fn().mockRejectedValue(new Error('AI service unavailable'))
      }) as any);

      const errCalls: string[] = [];
      vi.spyOn(console, 'error').mockImplementation((...args: any[]) => {
        errCalls.push(args.join(' '));
      });
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const { getHandler, restore } = captureSignalHandlers();

      let addHandler: ((filePath: string) => Promise<void>) | undefined;
      mockWatcherOn.mockImplementation((event: string, handler: any) => {
        if (event === 'add') addHandler = handler;
        return mockWatcher;
      });

      const watchPromise = watchDirectory('/watch/dir', defaultOptions);
      await new Promise(resolve => setTimeout(resolve, 10));

      if (addHandler) await addHandler('/watch/dir/document.pdf');

      getHandler('SIGINT')?.();
      await watchPromise;
      restore();

      expect(errCalls.join('\n')).toContain('AI service unavailable');
    });

    it('appends to history after a successful rename', async () => {
      await withAddHandler(defaultOptions, async (addHandler) => {
        await addHandler('/watch/dir/document.pdf');
      });

      expect(appendHistory).toHaveBeenCalled();
    });

    it('logs "Unknown error" when the rename pipeline throws a non-Error value', async () => {
      vi.mocked(FileRenamer).mockImplementationOnce(() => ({
        renameFiles: vi.fn().mockRejectedValue('string error')
      }) as any);

      const errCalls: string[] = [];
      vi.spyOn(console, 'error').mockImplementation((...args: any[]) => {
        errCalls.push(args.join(' '));
      });
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const { getHandler, restore } = captureSignalHandlers();

      let addHandler: ((filePath: string) => Promise<void>) | undefined;
      mockWatcherOn.mockImplementation((event: string, handler: any) => {
        if (event === 'add') addHandler = handler;
        return mockWatcher;
      });

      const watchPromise = watchDirectory('/watch/dir', defaultOptions);
      await new Promise(resolve => setTimeout(resolve, 10));

      if (addHandler) await addHandler('/watch/dir/document.pdf');

      getHandler('SIGINT')?.();
      await watchPromise;
      restore();

      expect(errCalls.join('\n')).toContain('Unknown error');
    });
  });

  // ─── Graceful shutdown ─────────────────────────────────────────────────────

  describe('graceful shutdown', () => {
    it('closes the watcher on SIGINT', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { getHandler, restore } = captureSignalHandlers();

      const watchPromise = watchDirectory('/watch/dir', defaultOptions);
      await new Promise(resolve => setTimeout(resolve, 10));

      getHandler('SIGINT')?.();
      await watchPromise;

      expect(mockWatcherClose).toHaveBeenCalled();
      restore();
      consoleSpy.mockRestore();
    });

    it('closes the watcher on SIGTERM', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { getHandler, restore } = captureSignalHandlers();

      const watchPromise = watchDirectory('/watch/dir', defaultOptions);
      await new Promise(resolve => setTimeout(resolve, 10));

      getHandler('SIGTERM')?.();
      await watchPromise;

      expect(mockWatcherClose).toHaveBeenCalled();
      restore();
      consoleSpy.mockRestore();
    });

    it('logs a shutdown message on SIGINT', async () => {
      const logCalls: string[] = [];
      vi.spyOn(console, 'log').mockImplementation((...args: any[]) => {
        logCalls.push(args.join(' '));
      });
      const { getHandler, restore } = captureSignalHandlers();

      const watchPromise = watchDirectory('/watch/dir', defaultOptions);
      await new Promise(resolve => setTimeout(resolve, 10));

      getHandler('SIGINT')?.();
      await watchPromise;
      restore();

      expect(logCalls.join('\n')).toMatch(/stop|shut|exit|watch/i);
    });
  });

  // ─── --no-ai flag ──────────────────────────────────────────────────────────

  describe('--no-ai flag', () => {
    it('passes noAi: true to the rename pipeline', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { getHandler, restore } = captureSignalHandlers();

      let addHandler: ((filePath: string) => Promise<void>) | undefined;
      mockWatcherOn.mockImplementation((event: string, handler: any) => {
        if (event === 'add') addHandler = handler;
        return mockWatcher;
      });

      const watchPromise = watchDirectory('/watch/dir', { ...defaultOptions, ai: false });
      await new Promise(resolve => setTimeout(resolve, 10));

      if (addHandler) await addHandler('/watch/dir/document.pdf');

      getHandler('SIGINT')?.();
      await watchPromise;
      restore();
      consoleSpy.mockRestore();

      const constructorCalls = vi.mocked(FileRenamer).mock.calls;
      const config = constructorCalls[constructorCalls.length - 1]?.[2] as any;
      expect(config?.noAi).toBe(true);
    });
  });

  // ─── --pattern flag ────────────────────────────────────────────────────────

  describe('--pattern flag', () => {
    it('passes patterns to the config when --pattern is provided', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { getHandler, restore } = captureSignalHandlers();

      let addHandler: ((filePath: string) => Promise<void>) | undefined;
      mockWatcherOn.mockImplementation((event: string, handler: any) => {
        if (event === 'add') addHandler = handler;
        return mockWatcher;
      });

      const watchPromise = watchDirectory('/watch/dir', { ...defaultOptions, pattern: ['s/old/new/'] });
      await new Promise(resolve => setTimeout(resolve, 10));

      if (addHandler) await addHandler('/watch/dir/document.pdf');

      getHandler('SIGINT')?.();
      await watchPromise;
      restore();
      consoleSpy.mockRestore();

      const constructorCalls = vi.mocked(FileRenamer).mock.calls;
      const config = constructorCalls[constructorCalls.length - 1]?.[2] as any;
      expect(config?.patterns).toEqual(['s/old/new/']);
    });
  });

  // ─── fileConfig fallback values ───────────────────────────────────────────

  describe('fileConfig fallback values', () => {
    it('uses hard-coded defaults when both options and loadConfig are empty', async () => {
      vi.mocked(loadConfig).mockResolvedValue({});

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { getHandler, restore } = captureSignalHandlers();

      const watchPromise = watchDirectory('/watch/dir', { ai: true, pattern: [] });
      await new Promise(resolve => setTimeout(resolve, 10));

      getHandler('SIGINT')?.();
      await watchPromise;

      restore();
      consoleSpy.mockRestore();

      const constructorCalls = vi.mocked(FileRenamer).mock.calls;
      const config = constructorCalls[constructorCalls.length - 1]?.[2] as any;
      expect(config?.namingConvention).toBe('kebab-case');
      expect(config?.concurrency).toBe(3);
      expect(config?.templateOptions?.category).toBe('general');
      expect(config?.templateOptions?.dateFormat).toBe('none');
    });

    it('parses depth as integer when provided as a string', async () => {
      vi.mocked(loadConfig).mockResolvedValue({});

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { getHandler, restore } = captureSignalHandlers();

      const watchPromise = watchDirectory('/watch/dir', { ai: true, pattern: [], depth: '4' });
      await new Promise(resolve => setTimeout(resolve, 10));

      getHandler('SIGINT')?.();
      await watchPromise;

      restore();
      consoleSpy.mockRestore();

      const constructorCalls = vi.mocked(FileRenamer).mock.calls;
      const config = constructorCalls[constructorCalls.length - 1]?.[2] as any;
      expect(config?.depth).toBe(4);
    });

    it('wraps a single pattern string in an array', async () => {
      vi.mocked(loadConfig).mockResolvedValue({});

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { getHandler, restore } = captureSignalHandlers();

      // pattern as a plain string, not an array — hits the `options.pattern ? [options.pattern] : []` branch
      const watchPromise = watchDirectory('/watch/dir', { ai: true, pattern: 's/old/new/' as any });
      await new Promise(resolve => setTimeout(resolve, 10));

      getHandler('SIGINT')?.();
      await watchPromise;

      restore();
      consoleSpy.mockRestore();

      const constructorCalls = vi.mocked(FileRenamer).mock.calls;
      const config = constructorCalls[constructorCalls.length - 1]?.[2] as any;
      expect(config?.patterns).toEqual(['s/old/new/']);
    });

    it('uses empty patterns array when pattern option is absent', async () => {
      vi.mocked(loadConfig).mockResolvedValue({});

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { getHandler, restore } = captureSignalHandlers();

      // pattern is undefined — hits the `[]` fallback in `options.pattern ? [options.pattern] : []`
      const watchPromise = watchDirectory('/watch/dir', { ai: true, pattern: undefined as any });
      await new Promise(resolve => setTimeout(resolve, 10));

      getHandler('SIGINT')?.();
      await watchPromise;

      restore();
      consoleSpy.mockRestore();

      const constructorCalls = vi.mocked(FileRenamer).mock.calls;
      const config = constructorCalls[constructorCalls.length - 1]?.[2] as any;
      expect(config?.patterns).toEqual([]);
    });

    it('uses values from loadConfig when options are absent', async () => {
      vi.mocked(loadConfig).mockResolvedValue({
        provider: 'openai',
        maxSize: 5,
        case: 'snake_case',
        template: 'document',
        name: 'Alice',
        date: 'iso',
        baseUrl: 'http://localhost:9999',
        model: 'custom-model',
        concurrency: 2,
        output: '/tmp/report.json',
        depth: 3,
        recursive: true
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { getHandler, restore } = captureSignalHandlers();

      const watchPromise = watchDirectory('/watch/dir', { ai: true, pattern: [] });
      await new Promise(resolve => setTimeout(resolve, 10));

      getHandler('SIGINT')?.();
      await watchPromise;

      restore();
      consoleSpy.mockRestore();

      const constructorCalls = vi.mocked(FileRenamer).mock.calls;
      const config = constructorCalls[0]?.[2] as any;
      expect(config?.namingConvention).toBe('snake_case');
      expect(config?.concurrency).toBe(2);
    });
  });

  // ─── API key resolution ────────────────────────────────────────────────────

  describe('API key resolution', () => {
    /** Helper: start watcher just until it reaches steady state, then shut down */
    async function startAndStop(opts: Record<string, any>): Promise<void> {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { getHandler, restore } = captureSignalHandlers();

      const watchPromise = watchDirectory('/watch/dir', opts);
      await new Promise(resolve => setTimeout(resolve, 10));

      getHandler('SIGINT')?.();
      await watchPromise;

      restore();
      consoleSpy.mockRestore();
    }

    it('resolves apiKey from ANTHROPIC_API_KEY env var for claude provider when no apiKey option is set', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'env-anthropic-key');
      try {
        await startAndStop({ ...defaultOptions, apiKey: undefined });
        expect(vi.mocked(AIServiceFactory.create)).toHaveBeenCalledWith(
          'claude',
          'env-anthropic-key',
          expect.anything()
        );
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it('resolves apiKey from CLAUDE_API_KEY env var for claude provider when no apiKey option is set', async () => {
      vi.stubEnv('CLAUDE_API_KEY', 'env-claude-key');
      // Ensure ANTHROPIC_API_KEY is not set so CLAUDE_API_KEY takes priority
      vi.stubEnv('ANTHROPIC_API_KEY', '');
      try {
        await startAndStop({ ...defaultOptions, apiKey: undefined });
        expect(vi.mocked(AIServiceFactory.create)).toHaveBeenCalledWith(
          'claude',
          'env-claude-key',
          expect.anything()
        );
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it('resolves apiKey from OPENAI_API_KEY env var for openai provider when no apiKey option is set', async () => {
      vi.stubEnv('OPENAI_API_KEY', 'env-openai-key');
      try {
        await startAndStop({ ...defaultOptions, provider: 'openai', apiKey: undefined });
        expect(vi.mocked(AIServiceFactory.create)).toHaveBeenCalledWith(
          'openai',
          'env-openai-key',
          expect.anything()
        );
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it('does not call AIServiceFactory.create for local provider (ollama) — requiresApiKey is false', async () => {
      vi.mocked(AIServiceFactory.create).mockClear();
      await startAndStop({ ...defaultOptions, provider: 'ollama', apiKey: undefined });
      expect(vi.mocked(AIServiceFactory.create)).toHaveBeenCalledWith(
        'ollama',
        undefined,
        expect.anything()
      );
      // The key point: apiKey stays undefined because the env-var block is skipped
      expect(vi.mocked(AIServiceFactory.create).mock.calls[0]?.[1]).toBeUndefined();
    });

    it('leaves apiKey undefined for claude provider when no apiKey option and no env vars are set', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', '');
      vi.stubEnv('CLAUDE_API_KEY', '');
      try {
        await startAndStop({ ...defaultOptions, apiKey: undefined });
        expect(vi.mocked(AIServiceFactory.create)).toHaveBeenCalledWith(
          'claude',
          undefined,
          expect.anything()
        );
      } finally {
        vi.unstubAllEnvs();
      }
    });
  });
});
