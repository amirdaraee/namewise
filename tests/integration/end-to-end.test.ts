import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';
import { DocumentParserFactory } from '../../src/parsers/factory.js';
import { FileRenamer } from '../../src/services/file-renamer.js';
import { createTempDir, copyTestFile, MockAIService, makeConfig, makeFileInfo } from './helpers/harness.js';

const execAsync = promisify(exec);
const cliPath = path.join(process.cwd(), 'dist', 'index.js');
const cliExists = existsSync(cliPath);

/**
 * CLI end-to-end tests.
 *
 * These tests invoke the built binary (dist/index.js) directly. Run
 * `npm run build` before running these tests. Tests are skipped if the
 * build does not exist.
 *
 * Scope: tests that do NOT require a live AI service (help, version, flag
 * validation, error paths). Full rename workflow is covered programmatically
 * in workflow.test.ts.
 */
describe.skipIf(!cliExists)('End-to-End CLI Tests', () => {
  describe('top-level help', () => {
    it('should show the tool description', async () => {
      const { stdout } = await execAsync(`node ${cliPath} --help`);
      expect(stdout).toContain('AI-powered CLI tool');
    });

    it('should list the rename command', async () => {
      const { stdout } = await execAsync(`node ${cliPath} --help`);
      expect(stdout).toContain('rename');
    });

    it('should print a semver version string', async () => {
      const { stdout } = await execAsync(`node ${cliPath} --version`);
      expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('rename command help', () => {
    it('should describe the rename command', async () => {
      const { stdout } = await execAsync(`node ${cliPath} rename --help`);
      expect(stdout).toContain('Rename files');
    });

    it('should show the optional directory argument', async () => {
      const { stdout } = await execAsync(`node ${cliPath} rename --help`);
      expect(stdout).toContain('[directory]');
    });

    it('should list all provider options', async () => {
      const { stdout } = await execAsync(`node ${cliPath} rename --help`);
      expect(stdout).toContain('claude');
      expect(stdout).toContain('openai');
      expect(stdout).toContain('ollama');
      expect(stdout).toContain('lmstudio');
    });

    it('should list all naming convention options', async () => {
      const { stdout } = await execAsync(`node ${cliPath} rename --help`);
      expect(stdout).toContain('kebab-case');
      expect(stdout).toContain('snake_case');
      expect(stdout).toContain('camelCase');
      expect(stdout).toContain('PascalCase');
      expect(stdout).toContain('lowercase');
      expect(stdout).toContain('UPPERCASE');
    });

    it('should list all template category options', async () => {
      const { stdout } = await execAsync(`node ${cliPath} rename --help`);
      expect(stdout).toContain('document');
      expect(stdout).toContain('movie');
      expect(stdout).toContain('music');
      expect(stdout).toContain('series');
      expect(stdout).toContain('photo');
      expect(stdout).toContain('book');
      expect(stdout).toContain('general');
    });

    it('should list all date format options', async () => {
      const { stdout } = await execAsync(`node ${cliPath} rename --help`);
      expect(stdout).toContain('YYYY-MM-DD');
      expect(stdout).toContain('YYYY');
      expect(stdout).toContain('YYYYMMDD');
      expect(stdout).toContain('none');
    });

    it('should show the --dry-run flag', async () => {
      const { stdout } = await execAsync(`node ${cliPath} rename --help`);
      expect(stdout).toContain('--dry-run');
    });

    it('should show the --max-size flag', async () => {
      const { stdout } = await execAsync(`node ${cliPath} rename --help`);
      expect(stdout).toContain('--max-size');
    });
  });

  describe('error handling', () => {
    it('should exit with non-zero code for a non-existent directory', async () => {
      await expect(
        execAsync(`node ${cliPath} rename /this/path/does/not/exist --dry-run`)
      ).rejects.toSatisfy((err: any) => {
        const output = (err.stderr ?? '') + (err.stdout ?? '');
        return output.includes('Error') || err.code !== 0;
      });
    });
  });
});

describe('End-to-End CLI Tests (build missing)', () => {
  it.skipIf(cliExists)('should note that the build is required for CLI tests', () => {
    console.warn(`CLI tests skipped: ${cliPath} not found. Run \`npm run build\` first.`);
    expect(true).toBe(true);
  });
});

describe('Image file end-to-end (programmatic)', () => {
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

  it('should dry-run rename a .jpg image file', async () => {
    const filePath = await copyTestFile('sample-image.jpg', tempDir);
    const stat = await fs.stat(filePath);
    const renamer = new FileRenamer(parserFactory, mockAI, makeConfig({ dryRun: true }));

    const { results } = await renamer.renameFiles([
      makeFileInfo(filePath, { size: stat.size, extension: '.jpg' })
    ]);

    expect(results[0].success).toBe(true);
    // Dry run: original file still at original path
    await expect(fs.access(filePath)).resolves.toBeUndefined();
    // Suggested name has .jpg extension
    expect(results[0].suggestedName).toMatch(/\.jpg$/);
  });
});
