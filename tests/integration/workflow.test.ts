import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { DocumentParserFactory } from '../../src/parsers/factory.js';
import { FileRenamer } from '../../src/services/file-renamer.js';
import { MockAIService } from '../mocks/mock-ai-service.js';
import { Config, FileInfo } from '../../src/types/index.js';

// Mock file system operations
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      ...actual.promises,
      rename: vi.fn(),
      access: vi.fn(),
      stat: vi.fn(),
      readdir: vi.fn()
    }
  };
});

describe('Workflow Integration Tests', () => {
  let mockAIService: MockAIService;
  let parserFactory: DocumentParserFactory;
  let fileRenamer: FileRenamer;
  let config: Config;
  const testDataDir = path.join(process.cwd(), 'tests/data');

  beforeEach(() => {
    mockAIService = new MockAIService();
    parserFactory = new DocumentParserFactory();
    config = {
      aiProvider: 'claude',
      apiKey: 'test-key',
      maxFileSize: 10 * 1024 * 1024,
      supportedExtensions: ['.txt', '.pdf', '.docx', '.xlsx', '.md'],
      dryRun: false,
      namingConvention: 'kebab-case',
      templateOptions: {
        category: 'general',
        personalName: undefined,
        dateFormat: 'none'
      }
    };

    fileRenamer = new FileRenamer(parserFactory, mockAIService, config);
    
    vi.clearAllMocks();
    mockAIService.resetCallCount();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Complete File Processing Workflow', () => {
    it('should process mixed file types successfully', async () => {
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

      // Mock successful file operations
      vi.mocked(fs.access).mockRejectedValue({ code: 'ENOENT' });
      vi.mocked(fs.rename).mockResolvedValue(undefined);

      // Set up different AI responses for different content types
      mockAIService.setMockResponse('default', 'project-requirements-document');
      mockAIService.setMockResponse('meeting', 'team-meeting-notes-march-2024');

      const results = await fileRenamer.renameFiles(testFiles);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
      expect(mockAIService.getCallCount()).toBe(2);
      expect(fs.rename).toHaveBeenCalledTimes(2);

      // Verify different filenames were generated
      expect(results[0].suggestedName).toContain('project-requirements-document');
      expect(results[1].suggestedName).toContain('team-meeting-notes');
    });

    it('should handle mixed success and failure scenarios', async () => {
      const testFiles: FileInfo[] = [
        {
          path: path.join(testDataDir, 'sample-text.txt'),
          name: 'sample-text.txt',
          extension: '.txt',
          size: 1000
        },
        {
          path: path.join(testDataDir, 'large-file.txt'),
          name: 'large-file.txt',
          extension: '.txt',
          size: 20 * 1024 * 1024 // Exceeds limit
        },
        {
          path: path.join(testDataDir, 'empty-file.txt'),
          name: 'empty-file.txt',
          extension: '.txt',
          size: 0
        }
      ];

      vi.mocked(fs.access).mockRejectedValue({ code: 'ENOENT' });
      vi.mocked(fs.rename).mockResolvedValue(undefined);

      const results = await fileRenamer.renameFiles(testFiles);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);  // Normal file
      expect(results[1].success).toBe(false); // Too large
      expect(results[2].success).toBe(false); // Empty file

      expect(results[1].error).toContain('File size');
      expect(results[2].error).toContain('No content could be extracted');

      // Only the successful file should trigger AI call and rename
      expect(mockAIService.getCallCount()).toBe(1);
      expect(fs.rename).toHaveBeenCalledOnce();
    });

    it('should respect dry-run mode across all files', async () => {
      config.dryRun = true;
      fileRenamer = new FileRenamer(parserFactory, mockAIService, config);

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

      const results = await fileRenamer.renameFiles(testFiles);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
      expect(mockAIService.getCallCount()).toBe(2); // AI should still be called
      expect(fs.rename).not.toHaveBeenCalled(); // But no actual renaming
    });

    it('should handle file conflicts appropriately', async () => {
      const testFiles: FileInfo[] = [
        {
          path: path.join(testDataDir, 'sample-text.txt'),
          name: 'sample-text.txt',
          extension: '.txt',
          size: 1000
        }
      ];

      // Simulate that the target filename already exists
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const results = await fileRenamer.renameFiles(testFiles);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('Target filename already exists');
      
      // AI should still be called, but no renaming should occur
      expect(mockAIService.getCallCount()).toBe(1);
      expect(fs.rename).not.toHaveBeenCalled();
    });
  });

  describe('Parser Integration', () => {
    it('should use correct parser for each file type', async () => {
      const testFiles: FileInfo[] = [
        {
          path: path.join(testDataDir, 'sample-text.txt'),
          name: 'sample-text.txt',
          extension: '.txt',
          size: 1000
        },
        {
          path: path.join(testDataDir, 'sample-pdf.pdf'),
          name: 'sample-pdf.pdf',
          extension: '.pdf',
          size: 2000
        }
      ];

      vi.mocked(fs.access).mockRejectedValue({ code: 'ENOENT' });
      vi.mocked(fs.rename).mockResolvedValue(undefined);

      const results = await fileRenamer.renameFiles(testFiles);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);

      // Both files should be processed successfully using their respective parsers
      expect(mockAIService.getCallCount()).toBe(2);
      expect(fs.rename).toHaveBeenCalledTimes(2);
    });

    it('should reject unsupported file types', async () => {
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
  });

  describe('AI Service Integration', () => {
    it('should handle AI service failures gracefully', async () => {
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

    it('should generate contextually appropriate filenames', async () => {
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

      // Verify that different content generates different filenames
      expect(results[0].suggestedName).not.toBe(results[1].suggestedName);
      
      // Filenames should reflect content
      expect(results[0].suggestedName).toContain('project-requirements-document');
      expect(results[1].suggestedName).toContain('team-meeting-notes');
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should continue processing after individual file failures', async () => {
      const testFiles: FileInfo[] = [
        {
          path: path.join(testDataDir, 'sample-text.txt'),
          name: 'sample-text.txt',
          extension: '.txt',
          size: 1000
        },
        {
          path: path.join(testDataDir, 'non-existent.txt'),
          name: 'non-existent.txt',
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

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);  // First file succeeds
      expect(results[1].success).toBe(false); // Second file fails
      expect(results[2].success).toBe(true);  // Third file still processes

      expect(results[1].error).toContain('Failed to parse text file');
      
      // Two successful files should generate AI calls and renames
      expect(mockAIService.getCallCount()).toBe(2);
      expect(fs.rename).toHaveBeenCalledTimes(2);
    });
  });
});