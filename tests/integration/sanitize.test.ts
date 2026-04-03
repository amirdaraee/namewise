import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { createTempDir } from './helpers/harness.js';

vi.mock('../../src/utils/history.js', () => ({
  appendHistory: vi.fn().mockResolvedValue(undefined)
}));

import { sanitizeFiles } from '../../src/cli/sanitize.js';

describe('sanitizeFiles() — integration', () => {
  let tempDir: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ dir: tempDir, cleanup } = await createTempDir());
  });

  afterEach(async () => {
    await cleanup();
    vi.clearAllMocks();
  });

  it('renames files with unsafe characters on disk', async () => {
    const dirty = path.join(tempDir, 'Report<2024>Final.txt');
    await fs.writeFile(dirty, 'content');

    vi.spyOn(console, 'log').mockImplementation(() => {});
    await sanitizeFiles(tempDir, { dryRun: false });

    const files = await fs.readdir(tempDir);
    expect(files).toContain('report-2024-final.txt');
    expect(files).not.toContain('Report<2024>Final.txt');
  });

  it('does not modify files on disk in dry-run mode', async () => {
    const dirty = path.join(tempDir, 'My File!.txt');
    await fs.writeFile(dirty, 'content');

    vi.spyOn(console, 'log').mockImplementation(() => {});
    await sanitizeFiles(tempDir, { dryRun: true });

    const files = await fs.readdir(tempDir);
    expect(files).toContain('My File!.txt');
  });
});
