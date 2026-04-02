import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { createTempDir } from './helpers/harness.js';
import { getFilesToProcessForTest } from '../../src/cli/rename.js';

const SUPPORTED = ['.txt', '.pdf', '.docx', '.xlsx', '.md'];

describe('getFilesToProcess() — recursive scanning', () => {
  let dir: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ dir, cleanup } = await createTempDir());
  });

  afterEach(async () => {
    await cleanup();
  });

  it('returns only top-level files when recursive is false (default)', async () => {
    await fs.writeFile(path.join(dir, 'top.txt'), 'content');
    const sub = path.join(dir, 'sub');
    await fs.mkdir(sub);
    await fs.writeFile(path.join(sub, 'nested.txt'), 'content');

    const files = await getFilesToProcessForTest(dir, SUPPORTED, false);
    expect(files.map(f => f.name)).toEqual(['top.txt']);
  });

  it('returns files from all subdirectories when recursive is true', async () => {
    await fs.writeFile(path.join(dir, 'top.txt'), 'content');
    const sub = path.join(dir, 'sub');
    await fs.mkdir(sub);
    await fs.writeFile(path.join(sub, 'nested.txt'), 'content');

    const files = await getFilesToProcessForTest(dir, SUPPORTED, true);
    const names = files.map(f => f.name).sort();
    expect(names).toEqual(['nested.txt', 'top.txt']);
  });

  it('respects depth limit', async () => {
    await fs.writeFile(path.join(dir, 'top.txt'), 'content');
    const level1 = path.join(dir, 'level1');
    await fs.mkdir(level1);
    await fs.writeFile(path.join(level1, 'level1.txt'), 'content');
    const level2 = path.join(level1, 'level2');
    await fs.mkdir(level2);
    await fs.writeFile(path.join(level2, 'level2.txt'), 'content');

    const files = await getFilesToProcessForTest(dir, SUPPORTED, true, 1);
    const names = files.map(f => f.name).sort();
    expect(names).toContain('top.txt');
    expect(names).toContain('level1.txt');
    expect(names).not.toContain('level2.txt');
  });

  it('skips files with unsupported extensions', async () => {
    await fs.writeFile(path.join(dir, 'file.txt'), 'content');
    await fs.writeFile(path.join(dir, 'file.jpg'), 'content');

    const files = await getFilesToProcessForTest(dir, SUPPORTED, false);
    expect(files.map(f => f.name)).toEqual(['file.txt']);
  });

  it('populates folderPath with up to 3 parent segments', async () => {
    const deep = path.join(dir, 'a', 'b', 'c');
    await fs.mkdir(deep, { recursive: true });
    await fs.writeFile(path.join(deep, 'doc.txt'), 'content');

    const files = await getFilesToProcessForTest(dir, SUPPORTED, true);
    expect(files[0].folderPath.length).toBeLessThanOrEqual(3);
  });
});
