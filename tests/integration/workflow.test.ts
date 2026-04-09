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

const DATA_DIR = path.join(process.cwd(), 'tests', 'data');

describe('Workflow Integration Tests', () => {
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

  describe('dry-run mode', () => {
    it('should call AI but not rename files', async () => {
      const filePath = await copyTestFile('sample-text.txt', tempDir);
      const stat = await fs.stat(filePath);
      const fileInfo = makeFileInfo(filePath, { size: stat.size });
      const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: true }));

      const { results } = await renamer.renameFiles([fileInfo]);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(mockAI.getCallCount()).toBe(1);

      // File should still be at the original path
      await expect(fs.access(filePath)).resolves.toBeUndefined();
    });

    it('should process multiple files without renaming any', async () => {
      const txtPath = await copyTestFile('sample-text.txt', tempDir);
      const mdPath = await copyTestFile('sample-markdown.md', tempDir);
      const txtStat = await fs.stat(txtPath);
      const mdStat = await fs.stat(mdPath);

      const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: true }));
      const { results } = await renamer.renameFiles([
        makeFileInfo(txtPath, { size: txtStat.size }),
        makeFileInfo(mdPath, { size: mdStat.size })
      ]);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
      expect(mockAI.getCallCount()).toBe(2);

      // Both files still exist at their original paths
      await expect(fs.access(txtPath)).resolves.toBeUndefined();
      await expect(fs.access(mdPath)).resolves.toBeUndefined();
    });
  });

  describe('actual rename', () => {
    it('should rename a txt file in the temp directory', async () => {
      const filePath = await copyTestFile('meeting-notes.txt', tempDir);
      const stat = await fs.stat(filePath);
      const fileInfo = makeFileInfo(filePath, { size: stat.size });

      const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: false }));
      const { results } = await renamer.renameFiles([fileInfo]);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].suggestedName).toMatch(/\.txt$/);

      // Original path should no longer exist; new path should
      await expect(fs.access(filePath)).rejects.toThrow();
      await expect(fs.access(results[0].newPath)).resolves.toBeUndefined();
    });
  });

  describe('error scenarios', () => {
    it('should fail gracefully for a file that exceeds the size limit', async () => {
      const filePath = await copyTestFile('sample-text.txt', tempDir);
      const fileInfo = makeFileInfo(filePath, { size: 20 * 1024 * 1024 }); // 20 MB
      const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ maxFileSize: 10 * 1024 * 1024 }));

      const { results } = await renamer.renameFiles([fileInfo]);

      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('exceeds maximum');
      expect(mockAI.getCallCount()).toBe(0);
    });

    it('should fail gracefully for empty files', async () => {
      const filePath = await copyTestFile('empty-file.txt', tempDir);
      const fileInfo = makeFileInfo(filePath, { size: 0 });
      const renamer = new FileRenamer(parserFactory, mockAI, makeConfig());

      const { results } = await renamer.renameFiles([fileInfo]);

      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('No content');
    });

    it('should fail for unsupported file extensions', async () => {
      // Create an unsupported file in the temp dir
      const unsupportedPath = path.join(tempDir, 'unknown.xyz');
      await fs.writeFile(unsupportedPath, 'some content');
      const fileInfo = makeFileInfo(unsupportedPath, { extension: '.xyz', size: 12 });
      const renamer = new FileRenamer(parserFactory, mockAI, makeConfig());

      const { results } = await renamer.renameFiles([fileInfo]);

      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('No parser available');
      expect(mockAI.getCallCount()).toBe(0);
    });

    it('should fail when AI service throws', async () => {
      mockAI.setShouldFail(true);
      const filePath = await copyTestFile('sample-text.txt', tempDir);
      const stat = await fs.stat(filePath);
      const fileInfo = makeFileInfo(filePath, { size: stat.size });
      const renamer = new FileRenamer(parserFactory, mockAI, makeConfig());

      const { results } = await renamer.renameFiles([fileInfo]);

      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('Mock AI service failed');
    });

    it('should auto-number when target filename already exists', async () => {
      const srcPath = await copyTestFile('sample-text.txt', tempDir);
      const stat = await fs.stat(srcPath);
      const fileInfo = makeFileInfo(srcPath, { size: stat.size });

      // Pre-create a file whose name the mock AI will suggest
      const suggestedName = `project-requirements-document.txt`;
      await fs.writeFile(path.join(tempDir, suggestedName), 'existing');

      const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: false }));
      const { results } = await renamer.renameFiles([fileInfo]);

      // Auto-numbering should succeed with a -2 suffix
      expect(results[0].success).toBe(true);
      expect(results[0].suggestedName).toBe('project-requirements-document-2.txt');
    });
  });

  describe('resilience across multiple files', () => {
    it('should continue processing after a file fails', async () => {
      const goodPath1 = await copyTestFile('sample-text.txt', tempDir);
      const goodPath2 = await copyTestFile('sample-markdown.md', tempDir);
      const goodStat1 = await fs.stat(goodPath1);
      const goodStat2 = await fs.stat(goodPath2);

      // One oversized file sandwiched between two good ones
      const oversize = makeFileInfo(path.join(tempDir, 'big.txt'), {
        size: 20 * 1024 * 1024,
        name: 'big.txt',
        extension: '.txt'
      });

      const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: true }));
      const { results } = await renamer.renameFiles([
        makeFileInfo(goodPath1, { size: goodStat1.size }),
        oversize,
        makeFileInfo(goodPath2, { size: goodStat2.size })
      ]);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
      expect(mockAI.getCallCount()).toBe(2);
    });
  });

  describe('naming conventions', () => {
    it.each([
      ['kebab-case', /^[a-z0-9]+(-[a-z0-9]+)*\./],
      ['snake_case', /^[a-z0-9]+(_[a-z0-9]+)*\./],
      ['camelCase', /^[a-z][a-zA-Z0-9]*\./],
      ['PascalCase', /^[A-Z][a-zA-Z0-9]*\./],
      ['lowercase', /^[a-z0-9]+\./],
      ['UPPERCASE', /^[A-Z0-9]+\./]
    ] as const)('should apply %s to the suggested filename', async (convention, pattern) => {
      const filePath = await copyTestFile('sample-text.txt', tempDir);
      const stat = await fs.stat(filePath);
      const fileInfo = makeFileInfo(filePath, { size: stat.size });
      const renamer = new FileRenamer(
        parserFactory,
        mockAI,
        makeConfig({ dryRun: true, namingConvention: convention })
      );

      const { results } = await renamer.renameFiles([fileInfo]);

      expect(results[0].success).toBe(true);
      expect(results[0].suggestedName).toMatch(pattern);
    });
  });

  describe('template categories', () => {
    it('should produce different filename shapes for general vs document templates', async () => {
      const filePath = await copyTestFile('sample-text.txt', tempDir);
      const stat = await fs.stat(filePath);

      const generalRenamer = new FileRenamer(
        parserFactory,
        mockAI,
        makeConfig({ dryRun: true, templateOptions: { category: 'general', dateFormat: 'none' } })
      );
      const documentRenamer = new FileRenamer(
        parserFactory,
        mockAI,
        makeConfig({
          dryRun: true,
          templateOptions: { category: 'document', personalName: 'testuser', dateFormat: 'YYYYMMDD' }
        })
      );

      const { results: generalResults } = await generalRenamer.renameFiles([makeFileInfo(filePath, { size: stat.size })]);
      const [generalResult] = generalResults;
      mockAI.reset();
      const { results: documentResults } = await documentRenamer.renameFiles([makeFileInfo(filePath, { size: stat.size })]);
      const [documentResult] = documentResults;

      expect(generalResult.success).toBe(true);
      expect(documentResult.success).toBe(true);

      // Document template includes personalName → the names differ
      expect(generalResult.suggestedName).not.toBe(documentResult.suggestedName);
      expect(documentResult.suggestedName).toContain('testuser');
    });
  });

  describe('token usage in RenameSessionResult', () => {
    it('should return token counts from MockAIService in RenameSessionResult', async () => {
      const filePath = await copyTestFile('sample-text.txt', tempDir);
      const stat = await fs.stat(filePath);
      const fileInfo = makeFileInfo(filePath, { size: stat.size });
      mockAI.setTokenValues(120, 8);
      const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: true }));

      const { results, tokenUsage } = await renamer.renameFiles([fileInfo]);

      expect(results[0].success).toBe(true);
      expect(tokenUsage.inputTokens).toBe(120);
      expect(tokenUsage.outputTokens).toBe(8);
    });

    it('should return undefined token totals when provider returns undefined tokens', async () => {
      const filePath = await copyTestFile('sample-text.txt', tempDir);
      const stat = await fs.stat(filePath);
      const fileInfo = makeFileInfo(filePath, { size: stat.size });
      mockAI.setTokenValues(undefined, undefined);
      const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: true }));

      const { tokenUsage } = await renamer.renameFiles([fileInfo]);

      expect(tokenUsage.inputTokens).toBeUndefined();
      expect(tokenUsage.outputTokens).toBeUndefined();
    });

    it('should accumulate tokens across multiple files', async () => {
      const txtPath = await copyTestFile('sample-text.txt', tempDir);
      const mdPath = await copyTestFile('sample-markdown.md', tempDir);
      const [txtStat, mdStat] = await Promise.all([fs.stat(txtPath), fs.stat(mdPath)]);
      mockAI.setTokenValues(50, 5);
      const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: true }));

      const { tokenUsage } = await renamer.renameFiles([
        makeFileInfo(txtPath, { size: txtStat.size }),
        makeFileInfo(mdPath, { size: mdStat.size })
      ]);

      expect(tokenUsage.inputTokens).toBe(100);  // 50 × 2
      expect(tokenUsage.outputTokens).toBe(10);  // 5 × 2
    });
  });
});
