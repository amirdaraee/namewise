import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import { PDFParser } from '../../src/parsers/pdf-parser.js';
import { DocumentParserFactory } from '../../src/parsers/factory.js';
import { FileRenamer } from '../../src/services/file-renamer.js';
import {
  createTempDir,
  copyTestFile,
  MockAIService,
  makeConfig,
  makeFileInfo,
  captureNoise
} from './helpers/harness.js';

const DATA_DIR = path.join(process.cwd(), 'tests', 'data');

describe('PDF library noise suppression', () => {
  it('should produce no stderr or console.warn output when parsing a text PDF', async () => {
    const parser = new PDFParser();
    const filePath = path.join(DATA_DIR, 'sample-pdf.pdf');

    const { result, stderrWrites, warnCalls } = await captureNoise(() =>
      parser.parse(filePath)
    );

    expect(stderrWrites).toEqual([]);
    expect(warnCalls).toEqual([]);
    expect(result.content).toBeTruthy(); // confirms text extraction actually ran
  });

  it('should produce no stderr or console.warn output when parsing a scanned PDF', async () => {
    // scanned-sample.pdf is a blank-page PDF (no text) — triggers the
    // PDFToImageConverter.convertFirstPageToBase64 + canvas path,
    // which is where the "TT: undefined function" warning used to leak.
    const parser = new PDFParser();
    const filePath = path.join(DATA_DIR, 'scanned-sample.pdf');

    const { result, stderrWrites, warnCalls } = await captureNoise(() =>
      parser.parse(filePath)
    );

    expect(stderrWrites).toEqual([]);
    expect(warnCalls).toEqual([]);
    expect(result.content).toMatch(/^\[SCANNED_PDF_IMAGE\]:/); // confirms image conversion path ran
  });
});

describe('FileRenamer onProgress callback', () => {
  let tempDir: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ dir: tempDir, cleanup } = await createTempDir());
  });

  afterEach(async () => {
    await cleanup();
  });

  it('should call onProgress exactly once per file in order with real files', async () => {
    const fileNames = ['meeting-notes.txt', 'quarterly-report.md', 'sample-text.txt'];
    const filePaths = await Promise.all(fileNames.map(n => copyTestFile(n, tempDir)));

    const fileInfos = await Promise.all(
      filePaths.map(async (fp) => {
        const stat = await fs.stat(fp);
        return makeFileInfo(fp, { size: stat.size });
      })
    );

    const mockAI = new MockAIService();
    const parserFactory = new DocumentParserFactory();
    const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: true, concurrency: 1 }));

    const calls: Array<[number, number, string]> = [];
    await renamer.renameFiles(fileInfos, (completed, total, currentFile) => {
      calls.push([completed, total, currentFile]);
    });

    expect(calls).toHaveLength(3);
    expect(calls[0]).toEqual([1, 3, fileInfos[0].name]);
    expect(calls[1]).toEqual([2, 3, fileInfos[1].name]);
    expect(calls[2]).toEqual([3, 3, fileInfos[2].name]);
  });
});
