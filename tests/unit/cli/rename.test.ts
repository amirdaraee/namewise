import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// All vi.mock calls are hoisted to the top of the file

// Mock fs
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      stat: vi.fn(),
      readdir: vi.fn(),
      rename: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined)
    }
  };
});

// Mock inquirer
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn()
  }
}));

// Mock DocumentParserFactory
vi.mock('../../../src/parsers/factory.js', () => ({
  DocumentParserFactory: vi.fn().mockImplementation(() => ({}))
}));

// Mock AIServiceFactory
vi.mock('../../../src/services/ai-factory.js', () => ({
  AIServiceFactory: {
    create: vi.fn().mockReturnValue({
      generateFileName: vi.fn()
    })
  }
}));

// Mock config loader
vi.mock('../../../src/utils/config-loader.js', () => ({
  loadConfig: vi.fn().mockResolvedValue({})
}));

// Mock history
vi.mock('../../../src/utils/history.js', () => ({
  appendHistory: vi.fn().mockResolvedValue(undefined)
}));

// Mock FileRenamer - use a module-level variable accessible in the factory
vi.mock('../../../src/services/file-renamer.js', () => {
  const mockRenameFilesMethod = vi.fn().mockResolvedValue({ results: [], tokenUsage: { inputTokens: 100, outputTokens: 10 } });
  const MockFileRenamer = vi.fn().mockImplementation(() => ({
    renameFiles: mockRenameFilesMethod
  }));
  // Attach the method to the constructor for easy access in tests
  (MockFileRenamer as any).__mockRenameFiles = mockRenameFilesMethod;
  return {
    FileRenamer: MockFileRenamer
  };
});

import { renameFiles, getFilesToProcessForTest } from '../../../src/cli/rename.js';
import { promises as fs } from 'fs';
import inquirer from 'inquirer';
import { FileRenamer } from '../../../src/services/file-renamer.js';
import { loadConfig } from '../../../src/utils/config-loader.js';
import { appendHistory } from '../../../src/utils/history.js';

describe('renameFiles()', () => {
  const mockStat = vi.mocked(fs.stat);
  const mockReaddir = vi.mocked(fs.readdir);
  const mockInquirerPrompt = vi.mocked(inquirer.prompt);
  // Access the attached mock method
  const mockRenameFilesMethod: ReturnType<typeof vi.fn> = (FileRenamer as any).__mockRenameFiles;

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
    // After clearAllMocks, we need to re-setup the default implementations
    mockStat.mockResolvedValue({
      isDirectory: () => true,
      size: 1024,
      birthtime: new Date(),
      mtime: new Date(),
      atime: new Date()
    } as any);
    mockReaddir.mockResolvedValue([]);
    mockInquirerPrompt.mockResolvedValue({ proceed: true });
    mockRenameFilesMethod.mockResolvedValue({ results: [], tokenUsage: { inputTokens: 100, outputTokens: 10 } });
    vi.mocked(loadConfig).mockResolvedValue({});
    vi.mocked(appendHistory).mockResolvedValue(undefined);
    // Reset FileRenamer mock implementation
    vi.mocked(FileRenamer).mockImplementation(() => ({
      renameFiles: mockRenameFilesMethod
    }) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Directory validation', () => {
    it('should exit with error when directory does not exist', async () => {
      const error = new Error('ENOENT: no such file or directory') as any;
      error.code = 'ENOENT';
      mockStat.mockRejectedValue(error);

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await renameFiles('/nonexistent/path', defaultOptions);

      expect(consoleSpy).toHaveBeenCalledWith('Error:', expect.stringContaining('ENOENT'));
      expect(exitSpy).toHaveBeenCalledWith(1);

      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should exit with error when path is not a directory', async () => {
      mockStat.mockResolvedValueOnce({
        isDirectory: () => false
      } as any);

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await renameFiles('/some/file.txt', defaultOptions);

      expect(consoleSpy).toHaveBeenCalledWith('Error:', expect.stringContaining('is not a directory'));
      expect(exitSpy).toHaveBeenCalledWith(1);

      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should show "Unknown error" when a non-Error is thrown', async () => {
      // Throw a non-Error object to test the `error instanceof Error` false branch (line 101)
      mockStat.mockRejectedValue('string error');

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await renameFiles('/test/dir', defaultOptions);

      expect(consoleSpy).toHaveBeenCalledWith('Error:', 'Unknown error');
      expect(exitSpy).toHaveBeenCalledWith(1);

      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('File discovery', () => {
    it('should log message when no supported files are found', async () => {
      mockReaddir.mockResolvedValue([]);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await renameFiles('/test/dir', defaultOptions);

      expect(consoleSpy).toHaveBeenCalledWith('No supported files found in the directory.');
      consoleSpy.mockRestore();
    });

    it('should filter out directories and unsupported files', async () => {
      const entries = [
        { name: 'doc.pdf', isFile: () => true, isDirectory: () => false },
        { name: 'image.jpg', isFile: () => true, isDirectory: () => false }, // unsupported
        { name: 'subdir', isFile: () => false, isDirectory: () => false },   // directory (recursive:false, so skip)
        { name: 'notes.txt', isFile: () => true, isDirectory: () => false }
      ] as any[];

      mockReaddir.mockResolvedValue(entries);

      mockStat
        .mockResolvedValueOnce({ isDirectory: () => true } as any)     // initial stat
        .mockResolvedValueOnce({ size: 1024, birthtime: new Date(), mtime: new Date(), atime: new Date() } as any) // doc.pdf
        .mockResolvedValueOnce({ size: 512, birthtime: new Date(), mtime: new Date(), atime: new Date() } as any);  // notes.txt

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await renameFiles('/test/dir', { ...defaultOptions, dryRun: true });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('2 files to process'));
      consoleSpy.mockRestore();
    });
  });

  describe('birthtime cross-platform behaviour', () => {
    // On Linux (ext4/btrfs) stat.birthtime is not stored by the kernel and Node.js
    // returns the same value as stat.mtime. This test documents that the code
    // handles that case gracefully — no crash, createdAt is populated.
    it('should populate createdAt even when birthtime equals mtime (Linux filesystem behaviour)', async () => {
      const sharedTime = new Date('2024-06-15T10:00:00Z');
      const entries = [
        { name: 'doc.pdf', isFile: () => true, isDirectory: () => false }
      ] as any[];

      mockReaddir.mockResolvedValue(entries);
      // getFilesToProcessForTest calls stat only per-file, not on the directory itself
      mockStat.mockResolvedValueOnce({
        size: 512,
        birthtime: sharedTime, // equals mtime — typical on Linux
        mtime: sharedTime,
        atime: new Date()
      } as any);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const files = await getFilesToProcessForTest(
        '/test/dir',
        ['.pdf', '.docx', '.xlsx', '.txt', '.md', '.rtf']
      );
      consoleSpy.mockRestore();

      expect(files).toHaveLength(1);
      expect(files[0].createdAt).toBeInstanceOf(Date);
      expect(files[0].createdAt).toEqual(sharedTime);
      // createdAt === modifiedAt is expected and valid on Linux — not an error
      expect(files[0].createdAt).toEqual(files[0].modifiedAt);
    });
  });

  describe('Dry-run mode', () => {
    it('should skip confirmation prompt in dry-run mode', async () => {
      const entries = [{ name: 'doc.pdf', isFile: () => true, isDirectory: () => false }] as any[];
      mockReaddir.mockResolvedValue(entries);
      mockStat
        .mockResolvedValueOnce({ isDirectory: () => true } as any)
        .mockResolvedValueOnce({ size: 1024, birthtime: new Date(), mtime: new Date(), atime: new Date() } as any);

      mockRenameFilesMethod.mockResolvedValue({
        results: [{ success: true, originalPath: '/test/dir/doc.pdf', newPath: '/test/dir/document.pdf' }],
        tokenUsage: { inputTokens: 100, outputTokens: 10 }
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await renameFiles('/test/dir', { ...defaultOptions, dryRun: true });

      // Should NOT prompt for confirmation
      expect(mockInquirerPrompt).not.toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ name: 'proceed' })])
      );

      consoleSpy.mockRestore();
    });

    it('should display preview results in dry-run mode', async () => {
      const entries = [{ name: 'doc.pdf', isFile: () => true, isDirectory: () => false }] as any[];
      mockReaddir.mockResolvedValue(entries);
      mockStat
        .mockResolvedValueOnce({ isDirectory: () => true } as any)
        .mockResolvedValueOnce({ size: 1024, birthtime: new Date(), mtime: new Date(), atime: new Date() } as any);

      mockRenameFilesMethod.mockResolvedValue({
        results: [{ success: true, originalPath: '/test/dir/doc.pdf', newPath: '/test/dir/document.pdf' }],
        tokenUsage: { inputTokens: 100, outputTokens: 10 }
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await renameFiles('/test/dir', { ...defaultOptions, dryRun: true });

      const allLogs = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(allLogs).toContain('Preview');

      consoleSpy.mockRestore();
    });
  });

  describe('Non-dry-run mode', () => {
    it('should prompt for confirmation and cancel when user declines', async () => {
      const entries = [{ name: 'doc.pdf', isFile: () => true, isDirectory: () => false }] as any[];
      mockReaddir.mockResolvedValue(entries);
      mockStat
        .mockResolvedValueOnce({ isDirectory: () => true } as any)
        .mockResolvedValueOnce({ size: 1024, birthtime: new Date(), mtime: new Date(), atime: new Date() } as any);

      mockInquirerPrompt.mockResolvedValue({ proceed: false });
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await renameFiles('/test/dir', { ...defaultOptions, dryRun: false });

      expect(consoleSpy).toHaveBeenCalledWith('Operation cancelled.');
      expect(mockRenameFilesMethod).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should rename files when user confirms', async () => {
      const entries = [{ name: 'doc.pdf', isFile: () => true, isDirectory: () => false }] as any[];
      mockReaddir.mockResolvedValue(entries);
      mockStat
        .mockResolvedValueOnce({ isDirectory: () => true } as any)
        .mockResolvedValueOnce({ size: 1024, birthtime: new Date(), mtime: new Date(), atime: new Date() } as any);

      mockInquirerPrompt.mockResolvedValue({ proceed: true });
      mockRenameFilesMethod.mockResolvedValue({
        results: [{ success: true, originalPath: '/test/dir/doc.pdf', newPath: '/test/dir/document.pdf' }],
        tokenUsage: { inputTokens: 100, outputTokens: 10 }
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await renameFiles('/test/dir', { ...defaultOptions, dryRun: false });

      expect(mockRenameFilesMethod).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('API key handling', () => {
    it('should use CLAUDE_API_KEY env var when no apiKey option provided', async () => {
      const originalKey = process.env.CLAUDE_API_KEY;
      process.env.CLAUDE_API_KEY = 'env-claude-key';
      mockReaddir.mockResolvedValue([]);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { AIServiceFactory } = await import('../../../src/services/ai-factory.js');

      await renameFiles('/test/dir', { ...defaultOptions, apiKey: undefined, provider: 'claude' });

      expect(AIServiceFactory.create).toHaveBeenCalledWith('claude', 'env-claude-key', expect.anything());

      process.env.CLAUDE_API_KEY = originalKey;
      consoleSpy.mockRestore();
    });

    it('should use ANTHROPIC_API_KEY env var when CLAUDE_API_KEY is not set', async () => {
      const savedClaude = process.env.CLAUDE_API_KEY;
      const savedAnthropic = process.env.ANTHROPIC_API_KEY;
      delete process.env.CLAUDE_API_KEY;
      process.env.ANTHROPIC_API_KEY = 'env-anthropic-key';
      mockReaddir.mockResolvedValue([]);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { AIServiceFactory } = await import('../../../src/services/ai-factory.js');

      try {
        await renameFiles('/test/dir', { ...defaultOptions, apiKey: undefined, provider: 'claude' });
        expect(AIServiceFactory.create).toHaveBeenCalledWith('claude', 'env-anthropic-key', expect.anything());
      } finally {
        if (savedClaude !== undefined) process.env.CLAUDE_API_KEY = savedClaude; else delete process.env.CLAUDE_API_KEY;
        if (savedAnthropic !== undefined) process.env.ANTHROPIC_API_KEY = savedAnthropic; else delete process.env.ANTHROPIC_API_KEY;
        consoleSpy.mockRestore();
      }
    });

    it('should use OPENAI_API_KEY env var when provider is openai', async () => {
      const originalKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'env-openai-key';
      mockReaddir.mockResolvedValue([]);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { AIServiceFactory } = await import('../../../src/services/ai-factory.js');

      await renameFiles('/test/dir', { ...defaultOptions, apiKey: undefined, provider: 'openai' });

      expect(AIServiceFactory.create).toHaveBeenCalledWith('openai', 'env-openai-key', expect.anything());

      process.env.OPENAI_API_KEY = originalKey;
      consoleSpy.mockRestore();
    });

    it('should prompt for API key when env var not set and no apiKey option', async () => {
      const originalClaudeKey = process.env.CLAUDE_API_KEY;
      delete process.env.CLAUDE_API_KEY;
      mockReaddir.mockResolvedValue([]);
      // First call returns apiKey, no second call needed (no files to confirm)
      mockInquirerPrompt.mockResolvedValueOnce({ apiKey: 'prompted-key' });
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { AIServiceFactory } = await import('../../../src/services/ai-factory.js');

      await renameFiles('/test/dir', { ...defaultOptions, apiKey: undefined, provider: 'claude' });

      expect(mockInquirerPrompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ type: 'password', name: 'apiKey' })
        ])
      );
      expect(AIServiceFactory.create).toHaveBeenCalledWith('claude', 'prompted-key', expect.anything());

      process.env.CLAUDE_API_KEY = originalClaudeKey;
      consoleSpy.mockRestore();
    });

    it('should not prompt for API key for ollama provider', async () => {
      mockReaddir.mockResolvedValue([]);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await renameFiles('/test/dir', { ...defaultOptions, apiKey: undefined, provider: 'ollama' });

      expect(mockInquirerPrompt).not.toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ name: 'apiKey' })])
      );

      consoleSpy.mockRestore();
    });

    it('should not prompt for API key for lmstudio provider', async () => {
      mockReaddir.mockResolvedValue([]);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await renameFiles('/test/dir', { ...defaultOptions, apiKey: undefined, provider: 'lmstudio' });

      expect(mockInquirerPrompt).not.toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ name: 'apiKey' })])
      );

      consoleSpy.mockRestore();
    });
  });

  describe('displayResults()', () => {
    it('should display successful results', async () => {
      const entries = [{ name: 'doc.pdf', isFile: () => true, isDirectory: () => false }] as any[];
      mockReaddir.mockResolvedValue(entries);
      mockStat
        .mockResolvedValueOnce({ isDirectory: () => true } as any)
        .mockResolvedValueOnce({ size: 1024, birthtime: new Date(), mtime: new Date(), atime: new Date() } as any);

      mockRenameFilesMethod.mockResolvedValue({
        results: [{ success: true, originalPath: '/test/dir/old-name.pdf', newPath: '/test/dir/new-name.pdf' }],
        tokenUsage: { inputTokens: 100, outputTokens: 10 }
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await renameFiles('/test/dir', { ...defaultOptions, dryRun: true });

      const allLogs = consoleSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(allLogs).toContain('old-name.pdf');
      expect(allLogs).toContain('new-name.pdf');

      consoleSpy.mockRestore();
    });

    it('should display failed results with error messages', async () => {
      const entries = [{ name: 'doc.pdf', isFile: () => true, isDirectory: () => false }] as any[];
      mockReaddir.mockResolvedValue(entries);
      mockStat
        .mockResolvedValueOnce({ isDirectory: () => true } as any)
        .mockResolvedValueOnce({ size: 1024, birthtime: new Date(), mtime: new Date(), atime: new Date() } as any);

      mockRenameFilesMethod.mockResolvedValue({
        results: [{ success: false, originalPath: '/test/dir/doc.pdf', newPath: '/test/dir/doc.pdf', error: 'Permission denied' }],
        tokenUsage: { inputTokens: 100, outputTokens: 10 }
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await renameFiles('/test/dir', { ...defaultOptions, dryRun: true });

      const allLogs = consoleSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(allLogs).toContain('failed');
      expect(allLogs).toContain('Permission denied');

      consoleSpy.mockRestore();
    });

    it('should display failed count when there are failures', async () => {
      const entries = [
        { name: 'good.pdf', isFile: () => true, isDirectory: () => false },
        { name: 'bad.pdf', isFile: () => true, isDirectory: () => false }
      ] as any[];
      mockReaddir.mockResolvedValue(entries);
      mockStat
        .mockResolvedValueOnce({ isDirectory: () => true } as any)
        .mockResolvedValueOnce({ size: 1024, birthtime: new Date(), mtime: new Date(), atime: new Date() } as any)
        .mockResolvedValueOnce({ size: 1024, birthtime: new Date(), mtime: new Date(), atime: new Date() } as any);

      mockRenameFilesMethod.mockResolvedValue({
        results: [
          { success: true, originalPath: '/test/dir/good.pdf', newPath: '/test/dir/renamed.pdf' },
          { success: false, originalPath: '/test/dir/bad.pdf', newPath: '/test/dir/bad.pdf', error: 'Failed' }
        ],
        tokenUsage: { inputTokens: 100, outputTokens: 10 }
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await renameFiles('/test/dir', { ...defaultOptions, dryRun: true });

      const allLogs = consoleSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(allLogs).toMatch(/1 files? failed/);

      consoleSpy.mockRestore();
    });

    it('should show "Results" (not "Preview") for non-dry-run mode', async () => {
      const entries = [{ name: 'doc.pdf', isFile: () => true, isDirectory: () => false }] as any[];
      mockReaddir.mockResolvedValue(entries);
      mockStat
        .mockResolvedValueOnce({ isDirectory: () => true } as any)
        .mockResolvedValueOnce({ size: 1024, birthtime: new Date(), mtime: new Date(), atime: new Date() } as any);

      mockInquirerPrompt.mockResolvedValue({ proceed: true });
      mockRenameFilesMethod.mockResolvedValue({
        results: [{ success: true, originalPath: '/test/dir/doc.pdf', newPath: '/test/dir/document.pdf' }],
        tokenUsage: { inputTokens: 100, outputTokens: 10 }
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await renameFiles('/test/dir', { ...defaultOptions, dryRun: false });

      const allLogs = consoleSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(allLogs).toContain('Results');

      consoleSpy.mockRestore();
    });
  });

  describe('--pattern flag', () => {
    beforeEach(() => {
      mockReaddir.mockResolvedValue([
        { name: 'old-report.txt', isDirectory: () => false, isFile: () => true } as any
      ]);
      mockStat.mockImplementation(async (p: any) => {
        if (String(p).endsWith('old-report.txt')) {
          return { isDirectory: () => false, isFile: () => true, size: 512, birthtime: new Date(), mtime: new Date(), atime: new Date() } as any;
        }
        return { isDirectory: () => true, isFile: () => false, size: 0, birthtime: new Date(), mtime: new Date(), atime: new Date() } as any;
      });
    });

    it('skips FileRenamer when --pattern is set', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      await renameFiles('/test/dir', { ...defaultOptions, pattern: ['s/old/new/'], dryRun: true });
      expect(mockRenameFilesMethod).not.toHaveBeenCalled();
    });

    it('does not call fs.rename in dry-run mode', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      await renameFiles('/test/dir', { ...defaultOptions, pattern: ['s/old/new/'], dryRun: true });
      expect(vi.mocked(fs.rename)).not.toHaveBeenCalled();
    });

    it('reports correct count in dry-run summary', async () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await renameFiles('/test/dir', { ...defaultOptions, pattern: ['s/old/new/'], dryRun: true });
      const output = spy.mock.calls.map(c => String(c[0])).join('\n');
      expect(output).toMatch(/Would rename 1 file\(s\)/);
      spy.mockRestore();
    });
  });

  describe('--pattern flag (additional coverage)', () => {
    beforeEach(() => {
      mockReaddir.mockResolvedValue([
        { name: 'already-good.txt', isDirectory: () => false, isFile: () => true } as any
      ]);
      mockStat.mockImplementation(async (p: any) => {
        if (String(p).endsWith('already-good.txt')) {
          return { isDirectory: () => false, isFile: () => true, size: 512, birthtime: new Date(), mtime: new Date(), atime: new Date() } as any;
        }
        return { isDirectory: () => true, isFile: () => false, size: 0, birthtime: new Date(), mtime: new Date(), atime: new Date() } as any;
      });
    });

    it('skips rename when pattern result equals the original filename (line 132 continue)', async () => {
      // Pattern replaces "already-good" with "already-good" — net result same as original
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await renameFiles('/test/dir', {
        ...defaultOptions,
        pattern: ['s/already-good/already-good/'],
        dryRun: true
      });
      // fs.rename should never be called because the name didn't change
      expect(vi.mocked(fs.rename)).not.toHaveBeenCalled();
      // Summary should say 0 renames
      const output = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(output).toMatch(/Would rename 0 file\(s\)/);
      logSpy.mockRestore();
    });

    it('calls appendHistory when NOT in dry-run mode and renames happened (lines 239-246)', async () => {
      // Pattern changes the name so a real rename is performed
      mockReaddir.mockResolvedValue([
        { name: 'old-report.txt', isDirectory: () => false, isFile: () => true } as any
      ]);
      mockStat.mockImplementation(async (p: any) => {
        if (String(p).endsWith('old-report.txt')) {
          return { isDirectory: () => false, isFile: () => true, size: 512, birthtime: new Date(), mtime: new Date(), atime: new Date() } as any;
        }
        return { isDirectory: () => true, isFile: () => false, size: 0, birthtime: new Date(), mtime: new Date(), atime: new Date() } as any;
      });
      vi.mocked(fs.rename).mockResolvedValue(undefined);

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await renameFiles('/test/dir', {
        ...defaultOptions,
        pattern: ['s/old/new/'],
        dryRun: false
      });

      expect(vi.mocked(fs.rename)).toHaveBeenCalledOnce();
      expect(vi.mocked(appendHistory)).toHaveBeenCalledWith(
        expect.objectContaining({
          dryRun: false,
          renames: expect.arrayContaining([
            expect.objectContaining({ originalPath: expect.stringContaining('old-report.txt') })
          ])
        })
      );
      logSpy.mockRestore();
    });
  });

  describe('stats output', () => {
    it('prints stats line with multiple extension types', async () => {
      mockReaddir.mockResolvedValue([
        { name: 'report.pdf', isDirectory: () => false, isFile: () => true } as any,
        { name: 'notes.txt', isDirectory: () => false, isFile: () => true } as any
      ]);
      mockStat.mockImplementation(async (p: any) => {
        const s = String(p);
        if (s.endsWith('report.pdf') || s.endsWith('notes.txt')) {
          return { isDirectory: () => false, isFile: () => true, size: 512, birthtime: new Date(), mtime: new Date(), atime: new Date() } as any;
        }
        return { isDirectory: () => true, isFile: () => false, size: 0, birthtime: new Date(), mtime: new Date(), atime: new Date() } as any;
      });
      mockRenameFilesMethod.mockResolvedValue({
        results: [
          { originalPath: '/test/dir/report.pdf', newPath: '/test/dir/document.pdf', success: true },
          { originalPath: '/test/dir/notes.txt', newPath: '/test/dir/notes.txt', success: true }
        ],
        tokenUsage: { inputTokens: 100, outputTokens: 10 }
      });
      mockInquirerPrompt.mockResolvedValue({ proceed: true });

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await renameFiles('/test/dir', defaultOptions);

      const allOutput = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(allOutput).toMatch(/Stats:/);
      expect(allOutput).toMatch(/PDF/);
      expect(allOutput).toMatch(/TXT/);

      logSpy.mockRestore();
    });

    it('prints a stats line with elapsed time and file info after processing', async () => {
      // Set up a .txt file entry in the directory
      mockReaddir.mockResolvedValue([
        { name: 'report.txt', isDirectory: () => false, isFile: () => true } as any
      ]);
      mockStat.mockImplementation(async (p: any) => {
        if (String(p).endsWith('report.txt')) {
          return { isDirectory: () => false, isFile: () => true, size: 1572864, birthtime: new Date(), mtime: new Date(), atime: new Date() } as any;
        }
        return { isDirectory: () => true, isFile: () => false, size: 0, birthtime: new Date(), mtime: new Date(), atime: new Date() } as any;
      });
      mockRenameFilesMethod.mockResolvedValue({
        results: [{ originalPath: '/test/dir/report.txt', newPath: '/test/dir/renamed.txt', suggestedName: 'renamed.txt', success: true }],
        tokenUsage: { inputTokens: 100, outputTokens: 10 }
      });
      mockInquirerPrompt.mockResolvedValue({ proceed: true });

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await renameFiles('/test/dir', defaultOptions);

      const allOutput = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(allOutput).toMatch(/Stats:/);
      expect(allOutput).toMatch(/elapsed/);
      expect(allOutput).toMatch(/MB/);
      expect(allOutput).toMatch(/1\.50 MB/);
      expect(allOutput).toMatch(/TXT/);

      logSpy.mockRestore();
    });
  });

  describe('token usage output', () => {
    beforeEach(() => {
      mockReaddir.mockResolvedValue([
        { name: 'doc.pdf', isDirectory: () => false, isFile: () => true } as any
      ]);
      mockStat.mockImplementation(async (p: any) => {
        if (String(p).endsWith('doc.pdf')) {
          return { isDirectory: () => false, isFile: () => true, size: 1024, birthtime: new Date(), mtime: new Date(), atime: new Date() } as any;
        }
        return { isDirectory: () => true, isFile: () => false, size: 0, birthtime: new Date(), mtime: new Date(), atime: new Date() } as any;
      });
      mockInquirerPrompt.mockResolvedValue({ proceed: true });
    });

    it('displays cloud token counts when inputTokens and outputTokens are defined', async () => {
      mockRenameFilesMethod.mockResolvedValue({
        results: [{ success: true, originalPath: '/test/dir/doc.pdf', newPath: '/test/dir/document.pdf' }],
        tokenUsage: { inputTokens: 1240, outputTokens: 87 }
      });

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await renameFiles('/test/dir', defaultOptions);

      const allOutput = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(allOutput).toContain('Tokens: 1,240 input / 87 output');

      logSpy.mockRestore();
    });

    it('displays N/A for local provider when tokenUsage has no values', async () => {
      mockRenameFilesMethod.mockResolvedValue({
        results: [{ success: true, originalPath: '/test/dir/doc.pdf', newPath: '/test/dir/document.pdf' }],
        tokenUsage: { inputTokens: undefined, outputTokens: undefined }
      });

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await renameFiles('/test/dir', defaultOptions);

      const allOutput = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(allOutput).toContain('Tokens: N/A (local provider)');

      logSpy.mockRestore();
    });
  });

  describe('--output flag (JSON report)', () => {
    beforeEach(() => {
      mockReaddir.mockResolvedValue([
        { name: 'doc.pdf', isDirectory: () => false, isFile: () => true } as any
      ]);
      mockStat.mockImplementation(async (p: any) => {
        if (String(p).endsWith('doc.pdf')) {
          return { isDirectory: () => false, isFile: () => true, size: 1024, birthtime: new Date(), mtime: new Date(), atime: new Date() } as any;
        }
        return { isDirectory: () => true, isFile: () => false, size: 0, birthtime: new Date(), mtime: new Date(), atime: new Date() } as any;
      });
      mockRenameFilesMethod.mockResolvedValue({
        results: [{ success: true, originalPath: '/test/dir/doc.pdf', newPath: '/test/dir/document.pdf' }],
        tokenUsage: { inputTokens: 100, outputTokens: 10 }
      });
      mockInquirerPrompt.mockResolvedValue({ proceed: true });
    });

    it('saves JSON report when --output is set and writeFile succeeds', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await renameFiles('/test/dir', { ...defaultOptions, output: '/tmp/report.json' });

      expect(vi.mocked(fs.writeFile)).toHaveBeenCalledWith('/tmp/report.json', expect.any(String), 'utf-8');
      const allOutput = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(allOutput).toContain('Report saved to: /tmp/report.json');

      logSpy.mockRestore();
    });

    it('warns when writeFile throws an Error (line 156)', async () => {
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('disk full'));
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await renameFiles('/test/dir', { ...defaultOptions, output: '/tmp/report.json' });

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('disk full'));

      logSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it('warns "Unknown error" when writeFile throws a non-Error (line 156-157 false branch)', async () => {
      vi.mocked(fs.writeFile).mockRejectedValue('not an error object');
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await renameFiles('/test/dir', { ...defaultOptions, output: '/tmp/report.json' });

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown error'));

      logSpy.mockRestore();
      warnSpy.mockRestore();
    });
  });

  describe('config ?? defaults', () => {
    it('uses hard-coded defaults when options and fileConfig are both empty', async () => {
      // All options absent — commander would not set these fields at all
      const minimalOptions = { apiKey: 'test-api-key', ai: true, pattern: [] as string[] };
      vi.mocked(loadConfig).mockResolvedValue({});
      mockReaddir.mockResolvedValue([]);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await renameFiles('/test/dir', minimalOptions);

      // Verify the config passed to FileRenamer uses all hard-coded defaults
      const config = vi.mocked(FileRenamer).mock.calls[0]?.[2] as any;
      expect(config?.namingConvention).toBe('kebab-case');
      expect(config?.templateOptions?.category).toBe('general');
      expect(config?.templateOptions?.dateFormat).toBe('none');
      expect(config?.recursive).toBe(false);
      expect(config?.concurrency).toBe(3);
      expect(config?.dryRun).toBe(false);

      logSpy.mockRestore();
    });

    it('uses depth from options when provided as a string', async () => {
      mockReaddir.mockResolvedValue([]);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await renameFiles('/test/dir', { ...defaultOptions, depth: '5', recursive: true });

      const config = vi.mocked(FileRenamer).mock.calls[0]?.[2] as any;
      expect(config?.depth).toBe(5);

      logSpy.mockRestore();
    });

    it('passes single --pattern string as a one-element array', async () => {
      mockReaddir.mockResolvedValue([]);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // pattern as a plain string (not wrapped in array) — hits the `options.pattern ? [options.pattern] : []` branch
      await renameFiles('/test/dir', { ...defaultOptions, pattern: 's/old/new/' as any });

      const config = vi.mocked(FileRenamer).mock.calls[0]?.[2] as any;
      expect(config?.patterns).toEqual(['s/old/new/']);

      logSpy.mockRestore();
    });

    it('prints elapsed time in seconds when run takes >= 1000ms', async () => {
      mockReaddir.mockResolvedValue([
        { name: 'doc.txt', isDirectory: () => false, isFile: () => true } as any
      ]);
      mockStat.mockImplementation(async (p: any) => {
        if (String(p).endsWith('doc.txt')) {
          return { isDirectory: () => false, isFile: () => true, size: 512, birthtime: new Date(), mtime: new Date(), atime: new Date() } as any;
        }
        return { isDirectory: () => true, isFile: () => false, size: 0, birthtime: new Date(), mtime: new Date(), atime: new Date() } as any;
      });
      mockRenameFilesMethod.mockResolvedValue({
        results: [{ originalPath: '/test/dir/doc.txt', newPath: '/test/dir/renamed.txt', success: true }],
        tokenUsage: { inputTokens: 100, outputTokens: 10 }
      });
      mockInquirerPrompt.mockResolvedValue({ proceed: true });

      // Mock Date.now to simulate 1500ms elapsed
      const dateSpy = vi.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValueOnce(1500);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await renameFiles('/test/dir', defaultOptions);

      const allOutput = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(allOutput).toMatch(/1\.5s elapsed/);

      dateSpy.mockRestore();
      logSpy.mockRestore();
    });
  });

  describe('--context flag', () => {
    it('should pass --context flag to Config.context', async () => {
      mockStat.mockImplementation(async (p: any) => {
        if (p === '.') return { isDirectory: () => true } as any;
        return { size: 1000, birthtime: new Date(), mtime: new Date(), atime: new Date() } as any;
      });
      mockReaddir.mockResolvedValue([
        { name: 'report.pdf', isFile: () => true, isDirectory: () => false }
      ] as any);

      await renameFiles('.', {
        ...defaultOptions,
        dryRun: true,
        context: 'These are tax documents'
      });

      const constructorCall = vi.mocked(FileRenamer).mock.calls[0];
      const config = constructorCall[2] as any;
      expect(config.context).toBe('These are tax documents');
    });
  });
});
