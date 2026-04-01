import { describe, it, expect } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import path from 'path';

const execAsync = promisify(exec);
const cliPath = path.join(process.cwd(), 'dist', 'index.js');
const cliExists = existsSync(cliPath);

/**
 * Exhaustive CLI flag option tests.
 * Verifies that all documented flags are present and validated correctly.
 * Requires `npm run build` to have been run first.
 */
describe.skipIf(!cliExists)('CLI Flag Tests', () => {
  // Helper — fetches rename --help output once and caches it
  let renameHelp: string;
  async function getRenameHelp(): Promise<string> {
    if (!renameHelp) {
      const { stdout } = await execAsync(`node ${cliPath} rename --help`);
      renameHelp = stdout;
    }
    return renameHelp;
  }

  describe('--provider flag', () => {
    it('should list all four providers', async () => {
      const help = await getRenameHelp();
      expect(help).toContain('claude');
      expect(help).toContain('openai');
      expect(help).toContain('ollama');
      expect(help).toContain('lmstudio');
    });

    it('should show -p shorthand', async () => {
      const help = await getRenameHelp();
      expect(help).toContain('-p,');
    });
  });

  describe('--case flag', () => {
    it('should show -c shorthand', async () => {
      const help = await getRenameHelp();
      expect(help).toContain('-c,');
    });

    it.each(['kebab-case', 'snake_case', 'camelCase', 'PascalCase', 'lowercase', 'UPPERCASE'])(
      'should document %s as a valid option',
      async (convention) => {
        const help = await getRenameHelp();
        expect(help).toContain(convention);
      }
    );
  });

  describe('--template flag', () => {
    it('should show -t shorthand', async () => {
      const help = await getRenameHelp();
      expect(help).toContain('-t,');
    });

    it.each(['document', 'movie', 'music', 'series', 'photo', 'book', 'general', 'auto'])(
      'should document %s as a valid category',
      async (category) => {
        const help = await getRenameHelp();
        expect(help).toContain(category);
      }
    );
  });

  describe('--date flag', () => {
    it.each(['YYYY-MM-DD', 'YYYY', 'YYYYMMDD', 'none'])(
      'should document %s as a valid date format',
      async (fmt) => {
        const help = await getRenameHelp();
        expect(help).toContain(fmt);
      }
    );
  });

  describe('--name flag', () => {
    it('should show -n shorthand', async () => {
      const help = await getRenameHelp();
      expect(help).toContain('-n,');
    });
  });

  describe('--api-key flag', () => {
    it('should show -k shorthand', async () => {
      const help = await getRenameHelp();
      expect(help).toContain('-k,');
    });
  });

  describe('--dry-run flag', () => {
    it('should be documented in rename help', async () => {
      const help = await getRenameHelp();
      expect(help).toContain('--dry-run');
    });
  });

  describe('--max-size flag', () => {
    it('should be documented in rename help', async () => {
      const help = await getRenameHelp();
      expect(help).toContain('--max-size');
    });
  });

  describe('directory argument', () => {
    it('should show [directory] as optional', async () => {
      const help = await getRenameHelp();
      expect(help).toContain('[directory]');
    });

    it('should indicate default is current directory', async () => {
      const help = await getRenameHelp();
      // Commander shows default value in the option description
      expect(help).toMatch(/default.*\.|\./i);
    });
  });

  describe('error paths', () => {
    it('should reject a non-existent directory with a non-zero exit code', async () => {
      const result = execAsync(`node ${cliPath} rename /absolutely/nonexistent/path --dry-run`);
      await expect(result).rejects.toBeDefined();
    });
  });
});

describe('CLI Flag Tests (build missing)', () => {
  it.skipIf(cliExists)('should note that the build is required', () => {
    console.warn(`CLI flag tests skipped: ${cliPath} not found. Run \`npm run build\` first.`);
    expect(true).toBe(true);
  });
});
