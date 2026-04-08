import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { FileRenamer } from '../../../src/services/file-renamer.js';
import { DocumentParserFactory } from '../../../src/parsers/factory.js';
import { MockAIService } from '../../integration/helpers/harness.js';
import { Config, FileInfo } from '../../../src/types/index.js';

// Mock fs.rename to avoid actual file operations
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      ...actual.promises,
      rename: vi.fn(),
      access: vi.fn()
    }
  };
});

describe('FileRenamer', () => {
  let fileRenamer: FileRenamer;
  let mockAIService: MockAIService;
  let parserFactory: DocumentParserFactory;
  let config: Config;
  const testDataDir = path.join(process.cwd(), 'tests/data');

  beforeEach(() => {
    mockAIService = new MockAIService();
    parserFactory = new DocumentParserFactory();
    config = {
      aiProvider: 'claude',
      apiKey: 'test-key',
      maxFileSize: 10 * 1024 * 1024, // 10MB
      supportedExtensions: ['.txt', '.pdf', '.docx', '.xlsx'],
      dryRun: false,
      namingConvention: 'kebab-case',
      concurrency: 1,
      templateOptions: {
        category: 'general',
        personalName: undefined,
        dateFormat: 'none'
      }
    };

    fileRenamer = new FileRenamer(parserFactory, mockAIService, config);

    // Reset mocks
    vi.clearAllMocks();
    mockAIService.resetCallCount();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('renameFiles()', () => {
    it('should successfully rename files', async () => {
      const testFiles: FileInfo[] = [
        {
          path: path.join(testDataDir, 'sample-text.txt'),
          name: 'sample-text.txt',
          extension: '.txt',
          size: 1000
        }
      ];

      // Mock fs.access to simulate that new file doesn't exist
      vi.mocked(fs.access).mockRejectedValue({ code: 'ENOENT' });
      vi.mocked(fs.rename).mockResolvedValue(undefined);

      const results = await fileRenamer.renameFiles(testFiles);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].originalPath).toBe(testFiles[0].path);
      expect(results[0].newPath).toContain('project-requirements-document.txt');
      expect(mockAIService.getCallCount()).toBe(1);
      expect(fs.rename).toHaveBeenCalledOnce();
    });

    it('should handle dry run mode', async () => {
      config.dryRun = true;
      fileRenamer = new FileRenamer(parserFactory, mockAIService, config);

      const testFiles: FileInfo[] = [
        {
          path: path.join(testDataDir, 'sample-text.txt'),
          name: 'sample-text.txt',
          extension: '.txt',
          size: 1000
        }
      ];

      // Mock fs.access to simulate that new file doesn't exist
      vi.mocked(fs.access).mockRejectedValue({ code: 'ENOENT' });

      const results = await fileRenamer.renameFiles(testFiles);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(mockAIService.getCallCount()).toBe(1);
      expect(fs.rename).not.toHaveBeenCalled(); // Should not rename in dry run
    });

    it('should handle file size limits', async () => {
      config.maxFileSize = 100; // Very small limit
      fileRenamer = new FileRenamer(parserFactory, mockAIService, config);

      const testFiles: FileInfo[] = [
        {
          path: path.join(testDataDir, 'sample-text.txt'),
          name: 'sample-text.txt',
          extension: '.txt',
          size: 1000 // Exceeds limit
        }
      ];

      const results = await fileRenamer.renameFiles(testFiles);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('File size');
      expect(results[0].error).toContain('exceeds maximum');
      expect(mockAIService.getCallCount()).toBe(0); // Should not call AI
      expect(fs.rename).not.toHaveBeenCalled();
    });

    it('should handle unsupported file types', async () => {
      const testFiles: FileInfo[] = [
        {
          path: path.join(testDataDir, 'unsupported.xyz'),
          name: 'unsupported.xyz',
          extension: '.xyz',
          size: 1000
        }
      ];

      const results = await fileRenamer.renameFiles(testFiles);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('No parser available');
      expect(mockAIService.getCallCount()).toBe(0);
      expect(fs.rename).not.toHaveBeenCalled();
    });

    it('should handle AI service failures', async () => {
      mockAIService.setShouldFail(true);

      const testFiles: FileInfo[] = [
        {
          path: path.join(testDataDir, 'sample-text.txt'),
          name: 'sample-text.txt',
          extension: '.txt',
          size: 1000
        }
      ];

      const results = await fileRenamer.renameFiles(testFiles);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('Mock AI service failed');
      expect(mockAIService.getCallCount()).toBe(1);
      expect(fs.rename).not.toHaveBeenCalled();
    });

    it('should auto-number filename when target already exists', async () => {
      const testFiles: FileInfo[] = [
        {
          path: path.join(testDataDir, 'sample-text.txt'),
          name: 'sample-text.txt',
          extension: '.txt',
          size: 1000
        }
      ];

      // First access call (base name) → file exists; -2 variant → ENOENT
      vi.mocked(fs.access).mockImplementation(async (filePath: any) => {
        if (String(filePath).includes('-2') || String(filePath).includes('-3')) {
          throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        }
        return undefined; // original target exists
      });
      vi.mocked(fs.rename).mockResolvedValue(undefined);

      const results = await fileRenamer.renameFiles(testFiles);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].newPath).toMatch(/-2\.txt$/);
      expect(mockAIService.getCallCount()).toBe(1);
      expect(fs.rename).toHaveBeenCalledOnce();
    });

    it('should fail when fs.access throws a non-ENOENT error on the base target path', async () => {
      const testFiles: FileInfo[] = [
        {
          path: path.join(testDataDir, 'sample-text.txt'),
          name: 'sample-text.txt',
          extension: '.txt',
          size: 1000
        }
      ];

      // Throw EACCES on the very first fs.access call (checking the base target path)
      vi.mocked(fs.access).mockRejectedValue(
        Object.assign(new Error('Permission denied'), { code: 'EACCES' })
      );

      const results = await fileRenamer.renameFiles(testFiles);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('Permission denied');
      expect(fs.rename).not.toHaveBeenCalled();
    });

    it('should fail when fs.access throws a non-ENOENT error on a numbered variant path', async () => {
      const testFiles: FileInfo[] = [
        {
          path: path.join(testDataDir, 'sample-text.txt'),
          name: 'sample-text.txt',
          extension: '.txt',
          size: 1000
        }
      ];

      // Base target exists (resolves), -2 variant throws EACCES
      vi.mocked(fs.access).mockImplementation(async (filePath: any) => {
        if (String(filePath).includes('-2')) {
          throw Object.assign(new Error('Permission denied'), { code: 'EACCES' });
        }
        return undefined; // base target exists
      });

      const results = await fileRenamer.renameFiles(testFiles);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('Permission denied');
      expect(fs.rename).not.toHaveBeenCalled();
    });

    it('should fail when all numbered variants -2 through -99 are taken', async () => {
      const testFiles: FileInfo[] = [
        {
          path: path.join(testDataDir, 'sample-text.txt'),
          name: 'sample-text.txt',
          extension: '.txt',
          size: 1000
        }
      ];

      // All paths exist — even -2 through -99
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const results = await fileRenamer.renameFiles(testFiles);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('Could not find an available filename');
      expect(fs.rename).not.toHaveBeenCalled();
    });

    it('should handle multiple files', async () => {
      const testFiles: FileInfo[] = [
        {
          path: path.join(testDataDir, 'sample-text.txt'),
          name: 'sample-text.txt',
          extension: '.txt',
          size: 1000
        },
        {
          path: path.join(testDataDir, 'sample-markdown.md'),
          name: 'sample-markdown.md',
          extension: '.md',
          size: 500
        }
      ];

      vi.mocked(fs.access).mockRejectedValue({ code: 'ENOENT' });
      vi.mocked(fs.rename).mockResolvedValue(undefined);

      const results = await fileRenamer.renameFiles(testFiles);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
      expect(mockAIService.getCallCount()).toBe(2);
      expect(fs.rename).toHaveBeenCalledTimes(2);
    });

    it('should handle empty file content', async () => {
      const testFiles: FileInfo[] = [
        {
          path: path.join(testDataDir, 'empty-file.txt'),
          name: 'empty-file.txt',
          extension: '.txt',
          size: 0
        }
      ];

      const results = await fileRenamer.renameFiles(testFiles);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('No content could be extracted');
      expect(mockAIService.getCallCount()).toBe(0);
      expect(fs.rename).not.toHaveBeenCalled();
    });

    it('should not rename if filename would be the same', async () => {
      // Set up mock to return a name that would result in the same filename
      mockAIService.setMockResponse('default', 'sample-text');

      const testFiles: FileInfo[] = [
        {
          path: path.join(testDataDir, 'sample-text.txt'),
          name: 'sample-text.txt',
          extension: '.txt',
          size: 1000
        }
      ];

      vi.mocked(fs.access).mockRejectedValue({ code: 'ENOENT' });

      const results = await fileRenamer.renameFiles(testFiles);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].originalPath).toBe(results[0].newPath); // Same path
      expect(mockAIService.getCallCount()).toBe(1);
      expect(fs.rename).not.toHaveBeenCalled(); // No rename needed
    });

    it('should use auto-categorization when templateOptions.category is "auto"', async () => {
      // Exercises the categorizeFile(file.path, content, file) branch at line 84
      config.templateOptions.category = 'auto';
      fileRenamer = new FileRenamer(parserFactory, mockAIService, config);

      const testFiles: FileInfo[] = [
        {
          path: path.join(testDataDir, 'sample-text.txt'),
          name: 'sample-text.txt',
          extension: '.txt',
          size: 1000
        }
      ];

      vi.mocked(fs.access).mockRejectedValue({ code: 'ENOENT' });
      vi.mocked(fs.rename).mockResolvedValue(undefined);

      const results = await fileRenamer.renameFiles(testFiles);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
    });

    it('should report failure when AI service returns empty filename', async () => {
      // Exercises the `!coreFileName || coreFileName.trim().length === 0` branch (lines 95-97)
      const emptyAIService = {
        name: 'EmptyAI',
        generateFileName: vi.fn().mockResolvedValue('')
      };
      fileRenamer = new FileRenamer(parserFactory, emptyAIService as any, config);

      const testFiles: FileInfo[] = [
        {
          path: path.join(testDataDir, 'sample-text.txt'),
          name: 'sample-text.txt',
          extension: '.txt',
          size: 1000
        }
      ];

      vi.mocked(fs.access).mockRejectedValue({ code: 'ENOENT' });

      const results = await fileRenamer.renameFiles(testFiles);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('Failed to generate a filename');
    });

    it('should use "Unknown error" when a non-Error is thrown during rename', async () => {
      // Exercises the `error instanceof Error` false branch (line 42 of file-renamer.ts)
      const nonErrorAIService = {
        name: 'NonErrorAI',
        generateFileName: vi.fn().mockRejectedValue('plain string error')
      };
      fileRenamer = new FileRenamer(parserFactory, nonErrorAIService as any, config);

      const testFiles: FileInfo[] = [
        {
          path: path.join(testDataDir, 'sample-text.txt'),
          name: 'sample-text.txt',
          extension: '.txt',
          size: 1000
        }
      ];

      vi.mocked(fs.access).mockRejectedValue({ code: 'ENOENT' });

      const results = await fileRenamer.renameFiles(testFiles);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('Unknown error');
    });

    it('should pass naming convention to AI service', async () => {
      config.namingConvention = 'snake_case';
      fileRenamer = new FileRenamer(parserFactory, mockAIService, config);

      // Spy on the generateFileName method
      const generateFileNameSpy = vi.spyOn(mockAIService, 'generateFileName');

      const testFiles: FileInfo[] = [
        {
          path: path.join(testDataDir, 'sample-text.txt'),
          name: 'sample-text.txt',
          extension: '.txt',
          size: 1000
        }
      ];

      // Mock fs.access to simulate that new file doesn't exist
      vi.mocked(fs.access).mockRejectedValue({ code: 'ENOENT' });

      const results = await fileRenamer.renameFiles(testFiles);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      
      // Verify AI service was called with the naming convention, category, file info, and language
      expect(generateFileNameSpy).toHaveBeenCalledWith(
        expect.any(String),
        'sample-text.txt',
        'snake_case',
        'general', // Uses general template since that's the default (no auto-categorization)
        expect.objectContaining({
          name: 'sample-text.txt',
          extension: '.txt',
          documentMetadata: expect.any(Object)
        }),
        undefined // no language configured
      );
    });

    it('should process files concurrently up to the configured limit', async () => {
      const concurrentConfig = { ...config, concurrency: 2 };
      const concurrentRenamer = new FileRenamer(parserFactory, mockAIService, concurrentConfig);

      let maxSimultaneous = 0;
      let currentlyActive = 0;

      const originalGenerate = mockAIService.generateFileName.bind(mockAIService);
      vi.spyOn(mockAIService, 'generateFileName').mockImplementation(async (...args: Parameters<typeof mockAIService.generateFileName>) => {
        currentlyActive++;
        if (currentlyActive > maxSimultaneous) maxSimultaneous = currentlyActive;
        await new Promise(resolve => setImmediate(resolve));
        currentlyActive--;
        return originalGenerate(...args);
      });

      const testFiles: FileInfo[] = [
        { path: path.join(testDataDir, 'sample-text.txt'), name: 'sample-text.txt', extension: '.txt', size: 1000 },
        { path: path.join(testDataDir, 'sample-markdown.md'), name: 'sample-markdown.md', extension: '.md', size: 500 },
        { path: path.join(testDataDir, 'contract-john-doe.txt'), name: 'contract-john-doe.txt', extension: '.txt', size: 800 }
      ];

      vi.mocked(fs.access).mockRejectedValue({ code: 'ENOENT' });
      vi.mocked(fs.rename).mockResolvedValue(undefined);

      const results = await concurrentRenamer.renameFiles(testFiles);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      expect(maxSimultaneous).toBe(2);
    });
  });

  describe('Console Output', () => {
    let originalStdoutWrite: typeof process.stdout.write;
    let stdoutOutput: string[];

    beforeEach(() => {
      stdoutOutput = [];
      originalStdoutWrite = process.stdout.write;
      
      // Mock process.stdout.write to capture output
      process.stdout.write = vi.fn((chunk: any) => {
        if (typeof chunk === 'string') {
          stdoutOutput.push(chunk);
        }
        return true;
      }) as any;
    });

    afterEach(() => {
      process.stdout.write = originalStdoutWrite;
    });

    it('should display progress messages during processing', async () => {
      const testFiles: FileInfo[] = [
        {
          path: path.join(testDataDir, 'file1.txt'),
          name: 'file1.txt',
          extension: '.txt',
          size: 1000
        },
        {
          path: path.join(testDataDir, 'file2.txt'),
          name: 'file2.txt',
          extension: '.txt',
          size: 1000
        },
        {
          path: path.join(testDataDir, 'very-long-filename-that-should-be-cleared-properly.txt'),
          name: 'very-long-filename-that-should-be-cleared-properly.txt',
          extension: '.txt',
          size: 1000
        }
      ];

      // Mock fs.access to simulate that new file doesn't exist
      vi.mocked(fs.access).mockRejectedValue({ code: 'ENOENT' });
      vi.mocked(fs.rename).mockResolvedValue(undefined);

      await fileRenamer.renameFiles(testFiles);

      // Check that progress messages were written
      const outputString = stdoutOutput.join('');
      expect(outputString).toContain('🔄 Processing [1/3] file1.txt');
      expect(outputString).toContain('🔄 Processing [2/3] file2.txt');
      expect(outputString).toContain('🔄 Processing [3/3] very-long-filename-that-should-be-cleared-prope...');
    });

    it('should properly clear previous progress lines', async () => {
      const testFiles: FileInfo[] = [
        {
          path: path.join(testDataDir, 'short.txt'),
          name: 'short.txt',
          extension: '.txt',
          size: 1000
        },
        {
          path: path.join(testDataDir, 'much-longer-filename-to-test-clearing.txt'),
          name: 'much-longer-filename-to-test-clearing.txt',
          extension: '.txt',
          size: 1000
        },
        {
          path: path.join(testDataDir, 'x.txt'),
          name: 'x.txt',
          extension: '.txt',
          size: 1000
        }
      ];

      // Mock fs.access to simulate that new file doesn't exist
      vi.mocked(fs.access).mockRejectedValue({ code: 'ENOENT' });
      vi.mocked(fs.rename).mockResolvedValue(undefined);

      await fileRenamer.renameFiles(testFiles);

      // Should contain clearing sequences (spaces to overwrite previous content)
      const outputString = stdoutOutput.join('');
      
      // Should contain carriage returns and spaces for clearing
      expect(outputString).toContain('\r');
      expect(outputString).toMatch(/\s+/); // Should contain spaces for clearing
      
      // Final clear should happen at the end
      const lastOutputs = stdoutOutput.slice(-3);
      expect(lastOutputs.some(output => output.includes('\r') && output.includes(' '))).toBe(true);
    });

    it('should handle single file processing correctly', async () => {
      const testFiles: FileInfo[] = [
        {
          path: path.join(testDataDir, 'single-file.txt'),
          name: 'single-file.txt',
          extension: '.txt',
          size: 1000
        }
      ];

      // Mock fs.access to simulate that new file doesn't exist
      vi.mocked(fs.access).mockRejectedValue({ code: 'ENOENT' });
      vi.mocked(fs.rename).mockResolvedValue(undefined);

      await fileRenamer.renameFiles(testFiles);

      const outputString = stdoutOutput.join('');
      expect(outputString).toContain('🔄 Processing [1/1] single-file.txt');
      
      // Should still clear the line at the end
      expect(outputString).toContain('\r');
    });

    it('should handle empty file list without console output', async () => {
      const testFiles: FileInfo[] = [];

      await fileRenamer.renameFiles(testFiles);

      // With no files, there should be minimal or no output
      expect(stdoutOutput.length).toBeLessThan(3);
    });

    it('should show completion message after processing', async () => {
      const testFiles: FileInfo[] = [
        {
          path: path.join(testDataDir, 'file1.txt'),
          name: 'file1.txt',
          extension: '.txt',
          size: 1000
        },
        {
          path: path.join(testDataDir, 'file2.txt'),
          name: 'file2.txt',
          extension: '.txt',
          size: 1000
        }
      ];

      // Mock fs.access to simulate that new file doesn't exist
      vi.mocked(fs.access).mockRejectedValue({ code: 'ENOENT' });
      vi.mocked(fs.rename).mockResolvedValue(undefined);

      await fileRenamer.renameFiles(testFiles);

      const outputString = stdoutOutput.join('');
      expect(outputString).toContain('Processed 2 files (2 successful)');
      expect(outputString).toContain('\n'); // Should end with newline
    });

    it('should truncate very long filenames in progress display', async () => {
      const longFilename = 'this-is-a-very-long-filename-that-should-be-truncated-for-better-display-purposes.txt';
      const testFiles: FileInfo[] = [
        {
          path: path.join(testDataDir, longFilename),
          name: longFilename,
          extension: '.txt',
          size: 1000
        }
      ];

      // Mock fs.access to simulate that new file doesn't exist
      vi.mocked(fs.access).mockRejectedValue({ code: 'ENOENT' });
      vi.mocked(fs.rename).mockResolvedValue(undefined);

      await fileRenamer.renameFiles(testFiles);

      const outputString = stdoutOutput.join('');
      expect(outputString).toContain('🔄 Processing [1/1] this-is-a-very-long-filename-that-should-be-tru...');
      expect(outputString).not.toContain(longFilename); // Full name should not appear
    });

    it('should handle mixed success/failure results in completion message', async () => {
      const testFiles: FileInfo[] = [
        {
          path: path.join(testDataDir, 'success.txt'),
          name: 'success.txt',
          extension: '.txt',
          size: 1000
        },
        {
          path: path.join(testDataDir, 'failure.txt'),
          name: 'failure.txt',
          extension: '.txt',
          size: 1000
        }
      ];

      // Mock the first file to succeed and second to fail
      vi.mocked(fs.access).mockImplementation((path: string) => {
        if (path.includes('success.txt')) {
          return Promise.reject({ code: 'ENOENT' }); // File doesn't exist, rename will succeed
        }
        return Promise.reject({ code: 'ENOENT' }); // File doesn't exist, rename will succeed
      });

      vi.mocked(fs.rename).mockImplementation((oldPath: string) => {
        if (oldPath.includes('failure.txt')) {
          return Promise.reject(new Error('Permission denied'));
        }
        return Promise.resolve(undefined);
      });

      await fileRenamer.renameFiles(testFiles);

      const outputString = stdoutOutput.join('');
      expect(outputString).toContain('Processed 2 files (1 successful)');
    });
  });
});