import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { FileRenamer } from '../../../src/services/file-renamer.js';
import { DocumentParserFactory } from '../../../src/parsers/factory.js';
import { MockAIService } from '../../mocks/mock-ai-service.js';
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
      namingConvention: 'kebab-case'
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

    it('should handle file conflicts', async () => {
      const testFiles: FileInfo[] = [
        {
          path: path.join(testDataDir, 'sample-text.txt'),
          name: 'sample-text.txt',
          extension: '.txt',
          size: 1000
        }
      ];

      // Mock fs.access to simulate that new file already exists
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const results = await fileRenamer.renameFiles(testFiles);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('Target filename already exists');
      expect(mockAIService.getCallCount()).toBe(1);
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
      
      // Verify AI service was called with the naming convention
      expect(generateFileNameSpy).toHaveBeenCalledWith(
        expect.any(String),
        'sample-text.txt',
        'snake_case'
      );
    });
  });
});