import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { DocumentParserFactory } from '../../src/parsers/factory.js';
import { FileRenamer } from '../../src/services/file-renamer.js';
import { AIProvider, FileInfo } from '../../src/types/index.js';
import {
  createTempDir,
  copyTestFile,
  makeConfig,
  makeFileInfo
} from './helpers/harness.js';

/** AI service that tracks how many calls are in-flight simultaneously. */
class TrackingAIService implements AIProvider {
  name = 'TrackingAI';
  private active = 0;
  maxSimultaneous = 0;
  private delay: number;

  constructor(delay = 20) {
    this.delay = delay;
  }

  async generateFileName(
    _content: string,
    originalName: string
  ): Promise<string> {
    this.active++;
    if (this.active > this.maxSimultaneous) this.maxSimultaneous = this.active;
    await new Promise(r => setTimeout(r, this.delay));
    this.active--;
    return `renamed-${originalName.replace(/\.[^/.]+$/, '')}`;
  }
}

describe('Concurrency control', () => {
  let tempDir: string;
  let cleanup: () => Promise<void>;
  let parserFactory: DocumentParserFactory;

  beforeEach(async () => {
    ({ dir: tempDir, cleanup } = await createTempDir());
    parserFactory = new DocumentParserFactory();
  });

  afterEach(async () => {
    await cleanup();
  });

  it('processes no more than concurrency files simultaneously', async () => {
    // Copy 5 files to process
    const files: FileInfo[] = [];
    for (let i = 0; i < 5; i++) {
      const dest = path.join(tempDir, `file-${i}.txt`);
      await fs.writeFile(dest, 'This is a project requirements document');
      const stat = await fs.stat(dest);
      files.push(makeFileInfo(dest, { size: stat.size, name: `file-${i}.txt`, extension: '.txt' }));
    }

    const trackingAI = new TrackingAIService(30);
    const renamer = new FileRenamer(parserFactory, trackingAI, makeConfig({ dryRun: true, concurrency: 2 }));

    await renamer.renameFiles(files);

    expect(trackingAI.maxSimultaneous).toBeLessThanOrEqual(2);
    expect(trackingAI.maxSimultaneous).toBeGreaterThanOrEqual(1);
  });

  it('processes all files even with concurrency = 1', async () => {
    const files: FileInfo[] = [];
    for (let i = 0; i < 3; i++) {
      const dest = path.join(tempDir, `seq-${i}.txt`);
      await fs.writeFile(dest, 'This is a project requirements document');
      const stat = await fs.stat(dest);
      files.push(makeFileInfo(dest, { size: stat.size, name: `seq-${i}.txt`, extension: '.txt' }));
    }

    const trackingAI = new TrackingAIService(10);
    const renamer = new FileRenamer(parserFactory, trackingAI, makeConfig({ dryRun: true, concurrency: 1 }));

    const results = await renamer.renameFiles(files);

    expect(results).toHaveLength(3);
    expect(results.every(r => r.success)).toBe(true);
    expect(trackingAI.maxSimultaneous).toBe(1);
  });

  it('all files are processed with higher concurrency', async () => {
    const count = 4;
    const files: FileInfo[] = [];
    for (let i = 0; i < count; i++) {
      const dest = path.join(tempDir, `par-${i}.txt`);
      await fs.writeFile(dest, 'This is a project requirements document');
      const stat = await fs.stat(dest);
      files.push(makeFileInfo(dest, { size: stat.size, name: `par-${i}.txt`, extension: '.txt' }));
    }

    const trackingAI = new TrackingAIService(20);
    const renamer = new FileRenamer(parserFactory, trackingAI, makeConfig({ dryRun: true, concurrency: 4 }));

    const results = await renamer.renameFiles(files);

    expect(results).toHaveLength(count);
    expect(results.filter(r => r.success)).toHaveLength(count);
  });
});
