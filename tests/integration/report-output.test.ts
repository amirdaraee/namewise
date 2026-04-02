import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { createTempDir } from './helpers/harness.js';

// Keep tests hermetic: no real AI calls, no history file writes
vi.mock('../../src/services/ai-factory.js', () => ({
  AIServiceFactory: {
    create: vi.fn().mockReturnValue({
      generateFileName: vi.fn().mockResolvedValue('report-output-test')
    })
  }
}));

vi.mock('../../src/utils/history.js', () => ({
  appendHistory: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('inquirer', () => ({
  default: { prompt: vi.fn().mockResolvedValue({ proceed: true }) }
}));

import { renameFiles } from '../../src/cli/rename.js';

describe('--output report JSON', () => {
  let tempDir: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ dir: tempDir, cleanup } = await createTempDir());
  });

  afterEach(async () => {
    await cleanup();
    vi.clearAllMocks();
  });

  it('writes a JSON report to the specified path', async () => {
    await fs.writeFile(path.join(tempDir, 'sample.txt'), 'This is a project requirements document');
    const reportPath = path.join(tempDir, 'report.json');

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await renameFiles(tempDir, {
      provider: 'claude',
      apiKey: 'test-key',
      dryRun: true,
      output: reportPath,
      concurrency: '1',
      recursive: false
    });

    consoleSpy.mockRestore();
    warnSpy.mockRestore();

    const raw = await fs.readFile(reportPath, 'utf-8');
    const report = JSON.parse(raw);

    expect(report).toMatchObject({
      directory: path.resolve(tempDir),
      dryRun: true,
      summary: {
        total: expect.any(Number),
        succeeded: expect.any(Number),
        failed: expect.any(Number)
      },
      results: expect.any(Array)
    });
    expect(typeof report.timestamp).toBe('string');
  });

  it('report summary counts match actual results', async () => {
    await fs.writeFile(path.join(tempDir, 'doc1.txt'), 'This is a project requirements document');
    await fs.writeFile(path.join(tempDir, 'doc2.txt'), 'This is a project requirements document');
    const reportPath = path.join(tempDir, 'summary.json');

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await renameFiles(tempDir, {
      provider: 'claude',
      apiKey: 'test-key',
      dryRun: true,
      output: reportPath,
      concurrency: '2',
      recursive: false
    });

    consoleSpy.mockRestore();
    warnSpy.mockRestore();

    const report = JSON.parse(await fs.readFile(reportPath, 'utf-8'));
    const { total, succeeded, failed } = report.summary;

    expect(total).toBe(succeeded + failed);
    expect(report.results).toHaveLength(total);
  });

  it('does not write a report when --output is not provided', async () => {
    await fs.writeFile(path.join(tempDir, 'file.txt'), 'This is a project requirements document');
    const reportPath = path.join(tempDir, 'should-not-exist.json');

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await renameFiles(tempDir, {
      provider: 'claude',
      apiKey: 'test-key',
      dryRun: true,
      concurrency: '1',
      recursive: false
    });

    consoleSpy.mockRestore();
    warnSpy.mockRestore();

    await expect(fs.access(reportPath)).rejects.toThrow();
  });
});
