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

describe('Parser Pipeline Integration Tests', () => {
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

  describe('TXT parser', () => {
    it('should extract non-empty content from a plain text file', async () => {
      const parser = parserFactory.getParser('file.txt');
      expect(parser).not.toBeNull();

      const result = await parser!.parse(path.join(DATA_DIR, 'sample-text.txt'));

      expect(result.content).toBeTruthy();
      expect(result.content.length).toBeGreaterThan(0);
    });

    it('should flow txt content through FileRenamer with mocked AI', async () => {
      const filePath = await copyTestFile('meeting-notes.txt', tempDir);
      const stat = await fs.stat(filePath);
      const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: true }));

      const { results } = await renamer.renameFiles([makeFileInfo(filePath, { size: stat.size })]);

      expect(results[0].success).toBe(true);
      expect(results[0].suggestedName).toMatch(/\.txt$/);
      expect(mockAI.getCallCount()).toBe(1);

      // AI received the actual file content
      const captured = mockAI.getCalls()[0];
      expect(captured.content).toContain('TEAM MEETING NOTES');
    });

    it('should populate wordCount metadata from txt content', async () => {
      const filePath = await copyTestFile('contract-john-doe.txt', tempDir);
      const stat = await fs.stat(filePath);
      const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: true }));

      await renamer.renameFiles([makeFileInfo(filePath, { size: stat.size })]);

      const captured = mockAI.getCalls()[0];
      expect(captured.fileInfo?.documentMetadata?.wordCount).toBeGreaterThan(0);
    });
  });

  describe('Markdown parser', () => {
    it('should extract non-empty content from a markdown file', async () => {
      const parser = parserFactory.getParser('file.md');
      expect(parser).not.toBeNull();

      const result = await parser!.parse(path.join(DATA_DIR, 'sample-markdown.md'));

      expect(result.content).toBeTruthy();
      expect(result.content.length).toBeGreaterThan(0);
    });

    it('should flow md content through FileRenamer with mocked AI', async () => {
      const filePath = await copyTestFile('quarterly-report.md', tempDir);
      const stat = await fs.stat(filePath);
      const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: true }));

      const { results } = await renamer.renameFiles([makeFileInfo(filePath, { size: stat.size })]);

      expect(results[0].success).toBe(true);
      expect(results[0].suggestedName).toMatch(/\.md$/);

      const captured = mockAI.getCalls()[0];
      expect(captured.content).toContain('Quarterly');
    });
  });

  describe('PDF parser', () => {
    it('should extract non-empty content from a pdf file', async () => {
      const parser = parserFactory.getParser('file.pdf');
      expect(parser).not.toBeNull();

      const result = await parser!.parse(path.join(DATA_DIR, 'sample-pdf.pdf'));

      expect(result.content).toBeTruthy();
      expect(result.content.length).toBeGreaterThan(0);
    });

    it('should flow pdf content through FileRenamer with mocked AI', async () => {
      const filePath = await copyTestFile('sample-pdf.pdf', tempDir);
      const stat = await fs.stat(filePath);
      const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: true }));

      const { results } = await renamer.renameFiles([makeFileInfo(filePath, { size: stat.size, extension: '.pdf' })]);

      expect(results[0].success).toBe(true);
      expect(results[0].suggestedName).toMatch(/\.pdf$/);
      expect(mockAI.getCallCount()).toBe(1);
    });
  });

  describe('DOCX parser', () => {
    it('should extract non-empty content from the generated docx fixture', async () => {
      const parser = parserFactory.getParser('file.docx');
      expect(parser).not.toBeNull();

      const result = await parser!.parse(path.join(DATA_DIR, 'sample-document.docx'));

      expect(result.content).toBeTruthy();
      expect(result.content.length).toBeGreaterThan(0);
    });

    it('should populate title metadata from the docx first line', async () => {
      const parser = parserFactory.getParser('file.docx');
      const result = await parser!.parse(path.join(DATA_DIR, 'sample-document.docx'));

      // WordParser infers title from the first short non-sentence line
      expect(result.metadata?.title).toBeTruthy();
    });

    it('should flow docx content through FileRenamer with mocked AI', async () => {
      const filePath = await copyTestFile('sample-document.docx', tempDir);
      const stat = await fs.stat(filePath);
      const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: true }));

      const { results } = await renamer.renameFiles([makeFileInfo(filePath, { size: stat.size, extension: '.docx' })]);

      expect(results[0].success).toBe(true);
      expect(results[0].suggestedName).toMatch(/\.docx$/);
      expect(mockAI.getCallCount()).toBe(1);

      const captured = mockAI.getCalls()[0];
      expect(captured.content).toBeTruthy();
      expect(captured.fileInfo?.documentMetadata?.title).toBeTruthy();
    });
  });

  describe('XLSX parser', () => {
    it('should extract non-empty content from the generated xlsx fixture', async () => {
      const parser = parserFactory.getParser('file.xlsx');
      expect(parser).not.toBeNull();

      const result = await parser!.parse(path.join(DATA_DIR, 'sample-spreadsheet.xlsx'));

      expect(result.content).toBeTruthy();
      expect(result.content.length).toBeGreaterThan(0);
    });

    it('should include sheet data in extracted content', async () => {
      const parser = parserFactory.getParser('file.xlsx');
      const result = await parser!.parse(path.join(DATA_DIR, 'sample-spreadsheet.xlsx'));

      // The fixture has columns: Category, Revenue, Expenses, Profit
      expect(result.content).toContain('Q4 Data');
    });

    it('should flow xlsx content through FileRenamer with mocked AI', async () => {
      const filePath = await copyTestFile('sample-spreadsheet.xlsx', tempDir);
      const stat = await fs.stat(filePath);
      const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: true }));

      const { results } = await renamer.renameFiles([makeFileInfo(filePath, { size: stat.size, extension: '.xlsx' })]);

      expect(results[0].success).toBe(true);
      expect(results[0].suggestedName).toMatch(/\.xlsx$/);
      expect(mockAI.getCallCount()).toBe(1);
    });
  });

  describe('unsupported extension', () => {
    it('should return an error result without calling AI for unknown extensions', async () => {
      const unsupportedPath = path.join(tempDir, 'unknown.xyz');
      await fs.writeFile(unsupportedPath, 'some content');
      const fileInfo = makeFileInfo(unsupportedPath, { extension: '.xyz', size: 12 });
      const renamer = new FileRenamer(parserFactory, mockAI, makeConfig());

      const { results } = await renamer.renameFiles([fileInfo]);

      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('No parser available');
      expect(mockAI.getCallCount()).toBe(0);
    });
  });

  describe('DocumentParserFactory', () => {
    it('should return correct parser for each supported extension', () => {
      const supported = ['.txt', '.md', '.pdf', '.docx', '.doc', '.xlsx', '.xls'];
      for (const ext of supported) {
        expect(parserFactory.getParser(`file${ext}`)).not.toBeNull();
      }
    });

    it('should return null for unsupported extensions', () => {
      expect(parserFactory.getParser('file.xyz')).toBeNull();
      expect(parserFactory.getParser('file.png')).toBeNull();
      expect(parserFactory.getParser('file.mp4')).toBeNull();
    });
  });
});
