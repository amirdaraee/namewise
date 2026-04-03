import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { createTempDir } from './helpers/harness.js';

vi.mock('inquirer', () => ({
  default: { prompt: vi.fn().mockResolvedValue({ confirm: true }) }
}));

import { dedupFiles } from '../../src/cli/dedup.js';

describe('dedupFiles() — integration', () => {
  let tempDir: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ dir: tempDir, cleanup } = await createTempDir());
  });

  afterEach(async () => {
    await cleanup();
    vi.clearAllMocks();
  });

  it('finds duplicate files with identical content', async () => {
    await fs.writeFile(path.join(tempDir, 'a.txt'), 'same content');
    await fs.writeFile(path.join(tempDir, 'b.txt'), 'same content');
    await fs.writeFile(path.join(tempDir, 'c.txt'), 'different content');

    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await dedupFiles(tempDir);
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('1 group');
    // verify size information is shown for each file
    expect(output).toMatch(/\(\d+(\.\d+)? (B|KB|MB)\)/);
    spy.mockRestore();
  });

  it('deletes duplicate files on disk when --delete confirmed', async () => {
    await fs.writeFile(path.join(tempDir, 'a.txt'), 'same');
    await fs.writeFile(path.join(tempDir, 'b.txt'), 'same');

    vi.spyOn(console, 'log').mockImplementation(() => {});
    await dedupFiles(tempDir, { delete: true });

    const files = await fs.readdir(tempDir);
    expect(files).toHaveLength(1);
  });
});
