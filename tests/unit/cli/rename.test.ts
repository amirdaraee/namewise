import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// All vi.mock calls are hoisted to the top of the file

// Mock fs
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      stat: vi.fn(),
      readdir: vi.fn()
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
  const mockRenameFilesMethod = vi.fn().mockResolvedValue([]);
  const MockFileRenamer = vi.fn().mockImplementation(() => ({
    renameFiles: mockRenameFilesMethod
  }));
  // Attach the method to the constructor for easy access in tests
  (MockFileRenamer as any).__mockRenameFiles = mockRenameFilesMethod;
  return {
    FileRenamer: MockFileRenamer
  };
});

import { renameFiles } from '../../../src/cli/rename.js';
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
    output: undefined
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
    mockRenameFilesMethod.mockResolvedValue([]);
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

  describe('Dry-run mode', () => {
    it('should skip confirmation prompt in dry-run mode', async () => {
      const entries = [{ name: 'doc.pdf', isFile: () => true, isDirectory: () => false }] as any[];
      mockReaddir.mockResolvedValue(entries);
      mockStat
        .mockResolvedValueOnce({ isDirectory: () => true } as any)
        .mockResolvedValueOnce({ size: 1024, birthtime: new Date(), mtime: new Date(), atime: new Date() } as any);

      mockRenameFilesMethod.mockResolvedValue([
        { success: true, originalPath: '/test/dir/doc.pdf', newPath: '/test/dir/document.pdf' }
      ]);

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

      mockRenameFilesMethod.mockResolvedValue([
        { success: true, originalPath: '/test/dir/doc.pdf', newPath: '/test/dir/document.pdf' }
      ]);

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
      mockRenameFilesMethod.mockResolvedValue([
        { success: true, originalPath: '/test/dir/doc.pdf', newPath: '/test/dir/document.pdf' }
      ]);

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

      mockRenameFilesMethod.mockResolvedValue([
        { success: true, originalPath: '/test/dir/old-name.pdf', newPath: '/test/dir/new-name.pdf' }
      ]);

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

      mockRenameFilesMethod.mockResolvedValue([
        { success: false, originalPath: '/test/dir/doc.pdf', newPath: '/test/dir/doc.pdf', error: 'Permission denied' }
      ]);

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

      mockRenameFilesMethod.mockResolvedValue([
        { success: true, originalPath: '/test/dir/good.pdf', newPath: '/test/dir/renamed.pdf' },
        { success: false, originalPath: '/test/dir/bad.pdf', newPath: '/test/dir/bad.pdf', error: 'Failed' }
      ]);

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
      mockRenameFilesMethod.mockResolvedValue([
        { success: true, originalPath: '/test/dir/doc.pdf', newPath: '/test/dir/document.pdf' }
      ]);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await renameFiles('/test/dir', { ...defaultOptions, dryRun: false });

      const allLogs = consoleSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(allLogs).toContain('Results');

      consoleSpy.mockRestore();
    });
  });
});
