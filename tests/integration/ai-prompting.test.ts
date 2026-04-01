import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import { DocumentParserFactory } from '../../src/parsers/factory.js';
import { FileRenamer } from '../../src/services/file-renamer.js';
import {
  createTempDir,
  copyTestFile,
  MockAIService,
  makeConfig,
  makeFileInfo
} from './helpers/harness.js';

describe('AI Prompting Integration Tests', () => {
  let tempDir: string;
  let cleanup: () => Promise<void>;
  let mockAI: MockAIService;
  let parserFactory: DocumentParserFactory;

  beforeEach(async () => {
    ({ dir: tempDir, cleanup } = await createTempDir());
    mockAI = new MockAIService();
    parserFactory = new DocumentParserFactory();
  });

  afterEach(async () => {
    await cleanup();
  });

  describe('naming convention forwarding', () => {
    it.each([
      'kebab-case',
      'snake_case',
      'camelCase',
      'PascalCase',
      'lowercase',
      'UPPERCASE'
    ] as const)('should pass %s to the AI service', async (convention) => {
      const filePath = await copyTestFile('sample-text.txt', tempDir);
      const stat = await fs.stat(filePath);
      const renamer = new FileRenamer(
        parserFactory,
        mockAI,
        makeConfig({ dryRun: true, namingConvention: convention })
      );

      await renamer.renameFiles([makeFileInfo(filePath, { size: stat.size })]);

      expect(mockAI.getCallCount()).toBe(1);
      expect(mockAI.getCalls()[0].namingConvention).toBe(convention);
    });
  });

  describe('category forwarding', () => {
    it.each([
      'general',
      'document',
      'movie',
      'music',
      'photo',
      'book'
    ] as const)('should pass %s category to the AI service', async (category) => {
      const filePath = await copyTestFile('sample-text.txt', tempDir);
      const stat = await fs.stat(filePath);
      const renamer = new FileRenamer(
        parserFactory,
        mockAI,
        makeConfig({ dryRun: true, templateOptions: { category, dateFormat: 'none' } })
      );

      await renamer.renameFiles([makeFileInfo(filePath, { size: stat.size })]);

      expect(mockAI.getCallCount()).toBe(1);
      expect(mockAI.getCalls()[0].category).toBe(category);
    });
  });

  describe('fileInfo metadata forwarding', () => {
    it('should pass parentFolder and folderPath in fileInfo', async () => {
      const filePath = await copyTestFile('sample-text.txt', tempDir);
      const stat = await fs.stat(filePath);
      const fileInfo = makeFileInfo(filePath, {
        size: stat.size,
        parentFolder: 'legal-docs',
        folderPath: ['home', 'documents', 'legal-docs']
      });
      const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: true }));

      await renamer.renameFiles([fileInfo]);

      const captured = mockAI.getCalls()[0];
      expect(captured.fileInfo?.parentFolder).toBe('legal-docs');
      expect(captured.fileInfo?.folderPath).toEqual(['home', 'documents', 'legal-docs']);
    });

    it('should populate documentMetadata after parsing a txt file', async () => {
      const filePath = await copyTestFile('contract-john-doe.txt', tempDir);
      const stat = await fs.stat(filePath);
      const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: true }));

      await renamer.renameFiles([makeFileInfo(filePath, { size: stat.size })]);

      const captured = mockAI.getCalls()[0];
      // Text parser populates wordCount at minimum
      expect(captured.fileInfo?.documentMetadata?.wordCount).toBeGreaterThan(0);
    });

    it('should pass the actual file size in fileInfo', async () => {
      const filePath = await copyTestFile('contract-john-doe.txt', tempDir);
      const stat = await fs.stat(filePath);
      const fileInfo = makeFileInfo(filePath, { size: stat.size });
      const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: true }));

      await renamer.renameFiles([fileInfo]);

      const captured = mockAI.getCalls()[0];
      expect(captured.fileInfo?.size).toBe(stat.size);
    });

    it('should forward content extracted from the real file to the AI', async () => {
      const filePath = await copyTestFile('contract-john-doe.txt', tempDir);
      const stat = await fs.stat(filePath);
      const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: true }));

      await renamer.renameFiles([makeFileInfo(filePath, { size: stat.size })]);

      const captured = mockAI.getCalls()[0];
      expect(captured.content).toContain('John Doe');
      expect(captured.content).toContain('Employment Contract');
    });
  });

  describe('auto category resolution', () => {
    it('should resolve auto category before passing to AI', async () => {
      const filePath = await copyTestFile('contract-john-doe.txt', tempDir);
      const stat = await fs.stat(filePath);
      const renamer = new FileRenamer(
        parserFactory,
        mockAI,
        makeConfig({ dryRun: true, templateOptions: { category: 'auto', dateFormat: 'none' } })
      );

      await renamer.renameFiles([makeFileInfo(filePath, { size: stat.size })]);

      const captured = mockAI.getCalls()[0];
      // 'auto' should be resolved — AI should receive a concrete category
      expect(captured.category).not.toBe('auto');
      expect(captured.category).toBeTruthy();
    });
  });
});
