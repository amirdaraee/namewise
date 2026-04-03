import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { createTempDir } from './helpers/harness.js';

vi.mock('../../src/utils/history.js', () => ({
  appendHistory: vi.fn().mockResolvedValue(undefined)
}));

import { applyPlan } from '../../src/cli/apply.js';

describe('applyPlan() — integration', () => {
  let tempDir: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ dir: tempDir, cleanup } = await createTempDir());
  });

  afterEach(async () => {
    await cleanup();
    vi.clearAllMocks();
  });

  it('renames files on disk from a valid plan', async () => {
    const originalPath = path.join(tempDir, 'old.txt');
    const newPath = path.join(tempDir, 'new.txt');
    await fs.writeFile(originalPath, 'content');

    const planPath = path.join(tempDir, 'plan.json');
    await fs.writeFile(planPath, JSON.stringify({
      results: [{ originalPath, newPath, success: true }]
    }));

    vi.spyOn(console, 'log').mockImplementation(() => {});
    await applyPlan(planPath);

    await expect(fs.access(newPath)).resolves.toBeUndefined();
    await expect(fs.access(originalPath)).rejects.toThrow();
  });

  it('does not rename in dry-run mode', async () => {
    const originalPath = path.join(tempDir, 'original.txt');
    const newPath = path.join(tempDir, 'renamed.txt');
    await fs.writeFile(originalPath, 'content');

    const planPath = path.join(tempDir, 'plan.json');
    await fs.writeFile(planPath, JSON.stringify({
      results: [{ originalPath, newPath, success: true }]
    }));

    vi.spyOn(console, 'log').mockImplementation(() => {});
    await applyPlan(planPath, { dryRun: true });

    await expect(fs.access(originalPath)).resolves.toBeUndefined();
    await expect(fs.access(newPath)).rejects.toThrow();
  });
});
