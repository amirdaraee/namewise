import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';
import { createTempDir, copyTestFile } from './helpers/harness.js';

const execFileAsync = promisify(execFile);
const cliPath = path.join(process.cwd(), 'dist', 'index.js');
const cliExists = existsSync(cliPath);

// ---------------------------------------------------------------------------
// Helper: run CLI with array args (no shell injection possible)
// ---------------------------------------------------------------------------
async function runCli(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const { stdout, stderr } = await execFileAsync('node', [cliPath, ...args]);
    return { stdout, stderr, code: 0 };
  } catch (err: any) {
    return {
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? '',
      code: err.code ?? 1
    };
  }
}

// ---------------------------------------------------------------------------
// Rename output correctness
// ---------------------------------------------------------------------------
describe.skipIf(!cliExists)('CLI output — rename', () => {
  let tempDir: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ dir: tempDir, cleanup } = await createTempDir());
    await copyTestFile('meeting-notes.txt', tempDir);
    await copyTestFile('quarterly-report.md', tempDir);
  });

  afterEach(async () => { await cleanup(); });

  it('stdout contains a progress bar', async () => {
    const { stdout } = await runCli(['rename', tempDir, '--dry-run', '--no-ai', '--api-key', 'dummy']);
    expect(stdout).toMatch(/\d+\/\d+/);
  });

  it('stdout contains ✓ success lines', async () => {
    const { stdout } = await runCli(['rename', tempDir, '--dry-run', '--no-ai', '--api-key', 'dummy']);
    expect(stdout).toContain('✓');
  });

  it('stderr is empty (no library noise)', async () => {
    const { stderr } = await runCli(['rename', tempDir, '--dry-run', '--no-ai', '--api-key', 'dummy']);
    expect(stderr).toBe('');
  });

  it('exits with code 0 on success', async () => {
    const { code } = await runCli(['rename', tempDir, '--dry-run', '--no-ai', '--api-key', 'dummy']);
    expect(code).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Batch flags
// ---------------------------------------------------------------------------
describe.skipIf(!cliExists)('CLI output — batch flags', () => {
  let tempDir: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ dir: tempDir, cleanup } = await createTempDir());
  });

  afterEach(async () => { await cleanup(); });

  it('--prefix adds text before the filename stem', async () => {
    await copyTestFile('meeting-notes.txt', tempDir);
    const { stdout } = await runCli(['rename', tempDir, '--prefix', 'hello', '--dry-run']);
    expect(stdout).toContain('hellomeeting-notes');
  });

  it('--suffix adds text after the filename stem', async () => {
    await copyTestFile('meeting-notes.txt', tempDir);
    const { stdout } = await runCli(['rename', tempDir, '--suffix', '_v1', '--dry-run']);
    expect(stdout).toContain('meeting-notes_v1');
  });

  it('--sequence numbers files starting from 001', async () => {
    await copyTestFile('file1.txt', tempDir);
    await copyTestFile('file2.txt', tempDir);
    await copyTestFile('short.txt', tempDir);
    const { stdout } = await runCli(['rename', tempDir, '--sequence', '--dry-run']);
    expect(stdout).toMatch(/→\s+001\.txt/);
    expect(stdout).toMatch(/→\s+002\.txt/);
    expect(stdout).toMatch(/→\s+003\.txt/);
  });

  it('--strip removes a substring from the filename stem', async () => {
    await copyTestFile('meeting-notes.txt', tempDir);
    const { stdout } = await runCli(['rename', tempDir, '--strip', 'meeting', '--dry-run']);
    expect(stdout).toMatch(/→\s+-notes\.txt/);
  });

  it('--truncate caps the filename stem length', async () => {
    await copyTestFile('meeting-notes.txt', tempDir);
    const { stdout } = await runCli(['rename', tempDir, '--truncate', '5', '--dry-run']);
    const match = stdout.match(/→\s+(\S+)\.txt/);
    expect(match).not.toBeNull();  // truncation must have changed the name
    expect(match![1].length).toBeLessThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// Pattern rename
// ---------------------------------------------------------------------------
describe.skipIf(!cliExists)('CLI output — pattern rename', () => {
  let tempDir: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ dir: tempDir, cleanup } = await createTempDir());
  });

  afterEach(async () => { await cleanup(); });

  it('--pattern applies sed-style substitution to filename stems', async () => {
    await copyTestFile('meeting-notes.txt', tempDir);
    const { stdout } = await runCli(['rename', tempDir, '--pattern', 's/notes/docs/', '--dry-run', '--api-key', 'dummy']);
    expect(stdout).toContain('meeting-docs');
  });
});

// ---------------------------------------------------------------------------
// Error paths
// ---------------------------------------------------------------------------
describe.skipIf(!cliExists)('CLI output — error paths', () => {
  it('exits non-zero and prints error for a non-existent directory', async () => {
    const { code, stderr, stdout } = await runCli([
      'rename', '/this/path/does/not/exist', '--dry-run'
    ]);
    expect(code).not.toBe(0);
    expect(stderr + stdout).toMatch(/error|not a directory|no such/i);
  });

  it('skips oversized files and still exits 0', async () => {
    const { dir: tempDir2, cleanup } = await createTempDir();
    try {
      await fs.writeFile(path.join(tempDir2, 'tiny.txt'), 'x');
      const { code, stdout } = await runCli([
        'rename', tempDir2, '--max-size', '0', '--dry-run', '--no-ai', '--api-key', 'dummy'
      ]);
      expect(code).toBe(0);
      expect(stdout).not.toContain('tiny →');
    } finally {
      await cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// Other commands — smoke tests
// ---------------------------------------------------------------------------
describe.skipIf(!cliExists)('CLI output — other commands smoke tests', () => {
  let tempDir: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ dir: tempDir, cleanup } = await createTempDir());
    await copyTestFile('meeting-notes.txt', tempDir);
    await copyTestFile('quarterly-report.md', tempDir);
  });

  afterEach(async () => { await cleanup(); });

  it('sanitize --dry-run exits 0 and produces output', async () => {
    const { code, stdout } = await runCli(['sanitize', tempDir, '--dry-run']);
    expect(code).toBe(0);
    expect(stdout.length).toBeGreaterThan(0);
  });

  it('stats exits 0 and produces output', async () => {
    const { code, stdout } = await runCli(['stats', tempDir]);
    expect(code).toBe(0);
    expect(stdout.length).toBeGreaterThan(0);
  });

  it('tree exits 0 and produces output', async () => {
    const { code, stdout } = await runCli(['tree', tempDir]);
    expect(code).toBe(0);
    expect(stdout.length).toBeGreaterThan(0);
  });

  it('info exits 0 and produces output for a single file', async () => {
    const filePath = path.join(tempDir, 'meeting-notes.txt');
    const { code, stdout } = await runCli(['info', filePath]);
    expect(code).toBe(0);
    expect(stdout.length).toBeGreaterThan(0);
  });

  it('find exits 0 and produces output', async () => {
    const { code, stdout } = await runCli(['find', tempDir]);
    expect(code).toBe(0);
    expect(stdout.length).toBeGreaterThan(0);
  });
});
