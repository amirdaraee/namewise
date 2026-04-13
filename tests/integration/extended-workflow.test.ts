import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import { DocumentParserFactory } from '../../src/parsers/factory.js';
import { FileRenamer } from '../../src/services/file-renamer.js';
import { AIProvider, AINameResult, FileInfo } from '../../src/types/index.js';
import {
  createTempDir,
  copyTestFile,
  MockAIService,
  makeConfig,
  makeFileInfo
} from './helpers/harness.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** AI stub that echoes every parameter it receives for inspection. */
class CapturingAI implements AIProvider {
  name = 'CapturingAI';
  calls: Array<{
    content: string;
    originalName: string;
    namingConvention?: string;
    category?: string;
    fileInfo?: FileInfo;
    language?: string;
    context?: string;
    imageData?: string;
  }> = [];

  async generateFileName(
    content: string,
    originalName: string,
    namingConvention?: string,
    category?: string,
    fileInfo?: FileInfo,
    language?: string,
    context?: string,
    imageData?: string
  ): Promise<AINameResult> {
    this.calls.push({ content, originalName, namingConvention, category, fileInfo, language, context, imageData });
    return { name: 'captured-result', inputTokens: 10, outputTokens: 5 };
  }
}

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

describe('Extended workflow — language & context forwarding', () => {
  let tempDir: string;
  let cleanup: () => Promise<void>;
  let parserFactory: DocumentParserFactory;

  beforeEach(async () => {
    ({ dir: tempDir, cleanup } = await createTempDir());
    parserFactory = new DocumentParserFactory();
  });

  afterEach(async () => { await cleanup(); });

  it('forwards the language option to the AI service', async () => {
    const filePath = await copyTestFile('sample-text.txt', tempDir);
    const stat = await fs.stat(filePath);
    const ai = new CapturingAI();
    const renamer = new FileRenamer(parserFactory, ai, makeConfig({ dryRun: true, language: 'fr' }));

    await renamer.renameFiles([makeFileInfo(filePath, { size: stat.size })]);

    expect(ai.calls).toHaveLength(1);
    expect(ai.calls[0].language).toBe('fr');
  });

  it('forwards the context option to the AI service', async () => {
    const filePath = await copyTestFile('sample-text.txt', tempDir);
    const stat = await fs.stat(filePath);
    const ai = new CapturingAI();
    const renamer = new FileRenamer(
      parserFactory, ai,
      makeConfig({ dryRun: true, context: 'quarterly financial archive' })
    );

    await renamer.renameFiles([makeFileInfo(filePath, { size: stat.size })]);

    expect(ai.calls[0].context).toBe('quarterly financial archive');
  });

  it('forwards both language and context simultaneously', async () => {
    const filePath = await copyTestFile('sample-text.txt', tempDir);
    const stat = await fs.stat(filePath);
    const ai = new CapturingAI();
    const renamer = new FileRenamer(
      parserFactory, ai,
      makeConfig({ dryRun: true, language: 'de', context: 'legal dept' })
    );

    await renamer.renameFiles([makeFileInfo(filePath, { size: stat.size })]);

    expect(ai.calls[0].language).toBe('de');
    expect(ai.calls[0].context).toBe('legal dept');
  });
});

// ---------------------------------------------------------------------------
// Empty input
// ---------------------------------------------------------------------------

describe('Extended workflow — empty file list', () => {
  it('returns empty results and zero tokens for an empty file list', async () => {
    const parserFactory = new DocumentParserFactory();
    const mockAI = new MockAIService();
    const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: true }));

    const { results, tokenUsage } = await renamer.renameFiles([]);

    expect(results).toHaveLength(0);
    expect(tokenUsage.inputTokens).toBeUndefined();
    expect(tokenUsage.outputTokens).toBeUndefined();
    expect(mockAI.getCallCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// noAi mode
// ---------------------------------------------------------------------------

describe('Extended workflow — noAi mode', () => {
  let tempDir: string;
  let cleanup: () => Promise<void>;
  let parserFactory: DocumentParserFactory;

  beforeEach(async () => {
    ({ dir: tempDir, cleanup } = await createTempDir());
    parserFactory = new DocumentParserFactory();
  });

  afterEach(async () => { await cleanup(); });

  it('does not call the AI service when noAi is true', async () => {
    const filePath = await copyTestFile('sample-document.docx', tempDir);
    const stat = await fs.stat(filePath);
    const ai = new CapturingAI();
    const renamer = new FileRenamer(
      parserFactory, ai,
      makeConfig({ dryRun: true, noAi: true, supportedExtensions: ['.docx'] })
    );

    const { results } = await renamer.renameFiles([
      makeFileInfo(filePath, { size: stat.size, extension: '.docx' })
    ]);

    expect(results[0].success).toBe(true);
    expect(ai.calls).toHaveLength(0);
  });

  it('still produces a filename from metadata in noAi mode', async () => {
    const filePath = await copyTestFile('sample-document.docx', tempDir);
    const stat = await fs.stat(filePath);
    const ai = new CapturingAI();
    const renamer = new FileRenamer(
      parserFactory, ai,
      makeConfig({ dryRun: true, noAi: true, supportedExtensions: ['.docx'] })
    );

    const { results } = await renamer.renameFiles([
      makeFileInfo(filePath, { size: stat.size, extension: '.docx' })
    ]);

    expect(results[0].success).toBe(true);
    expect(results[0].suggestedName).toMatch(/\.docx$/);
  });

  it('token usage is undefined when noAi is true', async () => {
    const filePath = await copyTestFile('sample-text.txt', tempDir);
    const stat = await fs.stat(filePath);
    const ai = new CapturingAI();
    const renamer = new FileRenamer(parserFactory, ai, makeConfig({ dryRun: true, noAi: true }));

    const { tokenUsage } = await renamer.renameFiles([makeFileInfo(filePath, { size: stat.size })]);

    expect(tokenUsage.inputTokens).toBeUndefined();
    expect(tokenUsage.outputTokens).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Series template category
// ---------------------------------------------------------------------------

describe('Extended workflow — series template category forwarding', () => {
  let tempDir: string;
  let cleanup: () => Promise<void>;
  let parserFactory: DocumentParserFactory;

  beforeEach(async () => {
    ({ dir: tempDir, cleanup } = await createTempDir());
    parserFactory = new DocumentParserFactory();
  });

  afterEach(async () => { await cleanup(); });

  it('forwards "series" category to the AI service', async () => {
    const filePath = await copyTestFile('sample-text.txt', tempDir);
    const stat = await fs.stat(filePath);
    const ai = new CapturingAI();
    const renamer = new FileRenamer(
      parserFactory, ai,
      makeConfig({ dryRun: true, templateOptions: { category: 'series', dateFormat: 'none' } })
    );

    await renamer.renameFiles([makeFileInfo(filePath, { size: stat.size })]);

    expect(ai.calls[0].category).toBe('series');
  });
});

// ---------------------------------------------------------------------------
// Mixed file types in one batch
// ---------------------------------------------------------------------------

describe('Extended workflow — mixed file types in one batch', () => {
  let tempDir: string;
  let cleanup: () => Promise<void>;
  let mockAI: MockAIService;
  let parserFactory: DocumentParserFactory;

  beforeEach(async () => {
    ({ dir: tempDir, cleanup } = await createTempDir());
    mockAI = new MockAIService();
    parserFactory = new DocumentParserFactory();
  });

  afterEach(async () => { await cleanup(); });

  it('successfully processes .txt, .md, .docx, .xlsx and .pdf in one call', async () => {
    const fixtures = [
      { file: 'sample-text.txt', ext: '.txt' },
      { file: 'quarterly-report.md', ext: '.md' },
      { file: 'sample-document.docx', ext: '.docx' },
      { file: 'sample-spreadsheet.xlsx', ext: '.xlsx' },
      { file: 'sample-pdf.pdf', ext: '.pdf' }
    ];

    const fileInfos: FileInfo[] = [];
    for (const { file, ext } of fixtures) {
      const fp = await copyTestFile(file, tempDir);
      const stat = await fs.stat(fp);
      fileInfos.push(makeFileInfo(fp, { size: stat.size, extension: ext }));
    }

    const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: true, concurrency: 3 }));
    const { results } = await renamer.renameFiles(fileInfos);

    expect(results).toHaveLength(fixtures.length);
    expect(results.every(r => r.success)).toBe(true);
    // Each result preserves the original extension
    for (let i = 0; i < fixtures.length; i++) {
      expect(results[i].suggestedName).toMatch(new RegExp(`\\${fixtures[i].ext}$`));
    }
  });

  it('accumulates tokens across a mixed-type batch', async () => {
    mockAI.setTokenValues(30, 3);
    const fixtures = ['sample-text.txt', 'quarterly-report.md', 'sample-pdf.pdf'];
    const fileInfos: FileInfo[] = [];

    for (const file of fixtures) {
      const fp = await copyTestFile(file, tempDir);
      const stat = await fs.stat(fp);
      const ext = path.extname(file);
      fileInfos.push(makeFileInfo(fp, { size: stat.size, extension: ext }));
    }

    const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: true }));
    const { tokenUsage } = await renamer.renameFiles(fileInfos);

    expect(tokenUsage.inputTokens).toBe(90);   // 30 × 3
    expect(tokenUsage.outputTokens).toBe(9);   // 3 × 3
  });
});

// ---------------------------------------------------------------------------
// Date format variations in document template
// ---------------------------------------------------------------------------

describe('Extended workflow — date format in document template', () => {
  let tempDir: string;
  let cleanup: () => Promise<void>;
  let mockAI: MockAIService;
  let parserFactory: DocumentParserFactory;

  beforeEach(async () => {
    ({ dir: tempDir, cleanup } = await createTempDir());
    mockAI = new MockAIService();
    parserFactory = new DocumentParserFactory();
  });

  afterEach(async () => { await cleanup(); });

  it.each([
    ['YYYY-MM-DD', /\d{4}-\d{2}-\d{2}/],
    ['YYYYMMDD',   /\d{8}/],
    ['YYYY',       /\d{4}/],
    ['none',       null]
  ] as const)('document template with dateFormat=%s produces the expected pattern', async (dateFormat, pattern) => {
    const filePath = await copyTestFile('sample-text.txt', tempDir);
    const stat = await fs.stat(filePath);
    const renamer = new FileRenamer(
      parserFactory, mockAI,
      makeConfig({
        dryRun: true,
        templateOptions: { category: 'document', personalName: 'alice', dateFormat }
      })
    );

    const { results } = await renamer.renameFiles([makeFileInfo(filePath, { size: stat.size })]);

    expect(results[0].success).toBe(true);
    const stem = results[0].suggestedName.replace(/\.[^.]+$/, '');
    if (pattern) {
      expect(stem).toMatch(pattern);
    } else {
      // 'none' — no date digits block of 4+ consecutive digits
      expect(stem).not.toMatch(/\d{8}/);
    }
    expect(stem).toContain('alice');
  });
});

// ---------------------------------------------------------------------------
// onProgress fires for both successful and failed files
// ---------------------------------------------------------------------------

describe('Extended workflow — onProgress with mixed outcomes', () => {
  let tempDir: string;
  let cleanup: () => Promise<void>;
  let parserFactory: DocumentParserFactory;

  beforeEach(async () => {
    ({ dir: tempDir, cleanup } = await createTempDir());
    parserFactory = new DocumentParserFactory();
  });

  afterEach(async () => { await cleanup(); });

  it('calls onProgress for every file including oversized ones', async () => {
    const goodPath = await copyTestFile('sample-text.txt', tempDir);
    const goodStat = await fs.stat(goodPath);

    const oversize = makeFileInfo(path.join(tempDir, 'big.txt'), {
      size: 20 * 1024 * 1024, name: 'big.txt', extension: '.txt'
    });

    const mockAI = new MockAIService();
    const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: true, concurrency: 1 }));

    const progressEvents: Array<[number, number, string]> = [];
    await renamer.renameFiles(
      [makeFileInfo(goodPath, { size: goodStat.size }), oversize],
      (completed, total, file) => progressEvents.push([completed, total, file])
    );

    // Both files should fire progress, regardless of success
    expect(progressEvents).toHaveLength(2);
    expect(progressEvents[0][0]).toBe(1);
    expect(progressEvents[1][0]).toBe(2);
  });

  it('monotonically increments completed count across failures', async () => {
    const goodPath = await copyTestFile('sample-text.txt', tempDir);
    const goodStat = await fs.stat(goodPath);

    const mockAI = new MockAIService();
    mockAI.setShouldFail(true);

    const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: true, concurrency: 1 }));

    const completedCounts: number[] = [];
    await renamer.renameFiles(
      [makeFileInfo(goodPath, { size: goodStat.size })],
      (completed) => completedCounts.push(completed)
    );

    expect(completedCounts).toEqual([1]);
  });
});

// ---------------------------------------------------------------------------
// Same-batch name collision
// ---------------------------------------------------------------------------

describe('Extended workflow — same-batch name collision', () => {
  let tempDir: string;
  let cleanup: () => Promise<void>;
  let parserFactory: DocumentParserFactory;

  beforeEach(async () => {
    ({ dir: tempDir, cleanup } = await createTempDir());
    parserFactory = new DocumentParserFactory();
  });

  afterEach(async () => { await cleanup(); });

  it('two files with identical AI suggestions get distinct final names', async () => {
    // Both files contain "project requirements" → MockAI returns the same stem
    const path1 = path.join(tempDir, 'file-a.txt');
    const path2 = path.join(tempDir, 'file-b.txt');
    await fs.writeFile(path1, 'This is a project requirements document');
    await fs.writeFile(path2, 'This is a project requirements document');

    const [stat1, stat2] = await Promise.all([fs.stat(path1), fs.stat(path2)]);

    const mockAI = new MockAIService();
    const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: false, concurrency: 1 }));

    const { results } = await renamer.renameFiles([
      makeFileInfo(path1, { size: stat1.size, name: 'file-a.txt', extension: '.txt' }),
      makeFileInfo(path2, { size: stat2.size, name: 'file-b.txt', extension: '.txt' })
    ]);

    expect(results.every(r => r.success)).toBe(true);
    // Names must differ — one gets the base, other gets -2
    const names = results.map(r => r.suggestedName);
    expect(new Set(names).size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// RenameResult field contract
// ---------------------------------------------------------------------------

describe('Extended workflow — RenameResult structure', () => {
  let tempDir: string;
  let cleanup: () => Promise<void>;
  let mockAI: MockAIService;
  let parserFactory: DocumentParserFactory;

  beforeEach(async () => {
    ({ dir: tempDir, cleanup } = await createTempDir());
    mockAI = new MockAIService();
    parserFactory = new DocumentParserFactory();
  });

  afterEach(async () => { await cleanup(); });

  it('result contains valid originalPath and newPath strings', async () => {
    const filePath = await copyTestFile('sample-text.txt', tempDir);
    const stat = await fs.stat(filePath);
    const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: true }));

    const { results } = await renamer.renameFiles([makeFileInfo(filePath, { size: stat.size })]);

    const result = results[0];
    expect(typeof result.originalPath).toBe('string');
    expect(typeof result.newPath).toBe('string');
    expect(result.originalPath).toBe(filePath);
    // In dry-run the new path still has a directory component
    expect(path.dirname(result.newPath)).toBe(path.dirname(filePath));
  });

  it('failed result has newPath equal to originalPath', async () => {
    mockAI.setShouldFail(true);
    const filePath = await copyTestFile('sample-text.txt', tempDir);
    const stat = await fs.stat(filePath);
    const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: true }));

    const { results } = await renamer.renameFiles([makeFileInfo(filePath, { size: stat.size })]);

    expect(results[0].success).toBe(false);
    expect(results[0].newPath).toBe(results[0].originalPath);
  });

  it('failed result error field is a non-empty string', async () => {
    // empty-file.txt has no content → ParseError path
    const filePath = await copyTestFile('empty-file.txt', tempDir);
    const stat = await fs.stat(filePath);
    const fileInfo = makeFileInfo(filePath, { size: stat.size });
    const renamer = new FileRenamer(parserFactory, mockAI, makeConfig());

    const { results } = await renamer.renameFiles([fileInfo]);

    expect(results[0].success).toBe(false);
    expect(typeof results[0].error).toBe('string');
    expect(results[0].error!.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Token accumulation with mixed success and failure
// ---------------------------------------------------------------------------

describe('Extended workflow — token accumulation with failures', () => {
  let tempDir: string;
  let cleanup: () => Promise<void>;
  let parserFactory: DocumentParserFactory;

  beforeEach(async () => {
    ({ dir: tempDir, cleanup } = await createTempDir());
    parserFactory = new DocumentParserFactory();
  });

  afterEach(async () => { await cleanup(); });

  it('tokens from successful files are counted; failed files contribute nothing', async () => {
    const goodPath = await copyTestFile('sample-text.txt', tempDir);
    const goodStat = await fs.stat(goodPath);

    const mockAI = new MockAIService();
    mockAI.setTokenValues(40, 4);

    // The oversized file will fail before AI is called
    const oversize = makeFileInfo(path.join(tempDir, 'big.txt'), {
      size: 20 * 1024 * 1024, name: 'big.txt', extension: '.txt'
    });

    const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: true, concurrency: 1 }));

    const { results, tokenUsage } = await renamer.renameFiles([
      makeFileInfo(goodPath, { size: goodStat.size }),
      oversize
    ]);

    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
    // Tokens only from the successful file
    expect(tokenUsage.inputTokens).toBe(40);
    expect(tokenUsage.outputTokens).toBe(4);
  });
});
