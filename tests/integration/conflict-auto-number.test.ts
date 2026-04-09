import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { DocumentParserFactory } from '../../src/parsers/factory.js';
import { FileRenamer } from '../../src/services/file-renamer.js';
import {
  createTempDir,
  copyTestFile,
  MockAIService,
  makeConfig,
  makeFileInfo
} from './helpers/harness.js';

describe('Conflict auto-numbering', () => {
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

  it('renames to -2 when suggested name is taken', async () => {
    const srcPath = await copyTestFile('sample-text.txt', tempDir);
    const stat = await fs.stat(srcPath);

    // Pre-create the file the AI will suggest
    await fs.writeFile(path.join(tempDir, 'project-requirements-document.txt'), 'existing');

    const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: false }));
    const { results: [result] } = await renamer.renameFiles([makeFileInfo(srcPath, { size: stat.size })]);

    expect(result.success).toBe(true);
    expect(path.basename(result.newPath)).toBe('project-requirements-document-2.txt');
    await expect(fs.access(result.newPath)).resolves.toBeUndefined();
  });

  it('renames to -3 when -2 is also taken', async () => {
    const srcPath = await copyTestFile('sample-text.txt', tempDir);
    const stat = await fs.stat(srcPath);

    await fs.writeFile(path.join(tempDir, 'project-requirements-document.txt'), 'existing');
    await fs.writeFile(path.join(tempDir, 'project-requirements-document-2.txt'), 'existing-2');

    const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: false }));
    const { results: [result] } = await renamer.renameFiles([makeFileInfo(srcPath, { size: stat.size })]);

    expect(result.success).toBe(true);
    expect(path.basename(result.newPath)).toBe('project-requirements-document-3.txt');
  });

  it('dry-run reports the -2 name without creating any files', async () => {
    const srcPath = await copyTestFile('sample-text.txt', tempDir);
    const stat = await fs.stat(srcPath);

    await fs.writeFile(path.join(tempDir, 'project-requirements-document.txt'), 'existing');

    const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: true }));
    const { results: [result] } = await renamer.renameFiles([makeFileInfo(srcPath, { size: stat.size })]);

    expect(result.success).toBe(true);
    expect(path.basename(result.newPath)).toBe('project-requirements-document-2.txt');

    // Original file untouched; the -2 file does NOT get created in dry-run
    await expect(fs.access(srcPath)).resolves.toBeUndefined();
    await expect(fs.access(result.newPath)).rejects.toThrow();
  });
});
