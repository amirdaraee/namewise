import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Command } from 'commander';
import { setupCommands } from '../../../src/cli/commands.js';

// Mock the rename function to avoid actual execution
vi.mock('../../../src/cli/rename.js', () => ({
  renameFiles: vi.fn()
}));

vi.mock('../../../src/cli/config-cmd.js', () => ({
  configCommand: vi.fn()
}));

vi.mock('../../../src/cli/sanitize.js', () => ({
  sanitizeFiles: vi.fn()
}));

vi.mock('../../../src/cli/apply.js', () => ({
  applyPlan: vi.fn()
}));

vi.mock('../../../src/cli/dedup.js', () => ({
  dedupFiles: vi.fn()
}));

vi.mock('../../../src/cli/watch.js', () => ({
  watchDirectory: vi.fn()
}));

vi.mock('../../../src/cli/undo.js', () => ({
  undoRename: vi.fn()
}));

describe('CLI Commands', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    vi.clearAllMocks();
  });

  describe('setupCommands()', () => {
    it('should set up rename command', () => {
      setupCommands(program);
      
      const renameCommand = program.commands.find(cmd => cmd.name() === 'rename');
      expect(renameCommand).toBeDefined();
      expect(renameCommand?.description()).toBe('🚀 Rename files in a directory based on their content using AI analysis');
    });

    it('should configure rename command with correct arguments', () => {
      setupCommands(program);
      
      const renameCommand = program.commands.find(cmd => cmd.name() === 'rename');
      expect(renameCommand).toBeDefined();
      expect(renameCommand?.description()).toContain('Rename files in a directory');
    });

    it('should configure rename command with correct options', () => {
      setupCommands(program);
      
      const renameCommand = program.commands.find(cmd => cmd.name() === 'rename');
      expect(renameCommand).toBeDefined();
      
      const options = renameCommand?.options;
      expect(options).toBeDefined();
      
      // Check provider option
      const providerOption = options?.find(opt => opt.long === '--provider');
      expect(providerOption).toBeDefined();
      expect(providerOption?.description).toBe('AI provider: claude|openai|ollama|lmstudio (default: claude)');

      // Check api-key option
      const apiKeyOption = options?.find(opt => opt.long === '--api-key');
      expect(apiKeyOption).toBeDefined();
      expect(apiKeyOption?.description).toBe('API key for cloud providers (or set CLAUDE_API_KEY/ANTHROPIC_API_KEY/OPENAI_API_KEY)');

      // Check dry-run option
      const dryRunOption = options?.find(opt => opt.long === '--dry-run');
      expect(dryRunOption).toBeDefined();
      expect(dryRunOption?.description).toBe('Preview changes without renaming files (RECOMMENDED first!)');
      expect(dryRunOption?.defaultValue).toBe(false);

      // Check max-size option
      const maxSizeOption = options?.find(opt => opt.long === '--max-size');
      expect(maxSizeOption).toBeDefined();
      expect(maxSizeOption?.description).toBe('Maximum file size in MB (default: 10)');

      // Check new flags exist
      const recursiveOption = options?.find(opt => opt.long === '--recursive');
      expect(recursiveOption).toBeDefined();
      expect(recursiveOption?.defaultValue).toBe(false);

      const concurrencyOption = options?.find(opt => opt.long === '--concurrency');
      expect(concurrencyOption).toBeDefined();

      const outputOption = options?.find(opt => opt.long === '--output');
      expect(outputOption).toBeDefined();
    });

    it('should have short option aliases', () => {
      setupCommands(program);
      
      const renameCommand = program.commands.find(cmd => cmd.name() === 'rename');
      const options = renameCommand?.options;
      
      // Check provider has -p alias
      const providerOption = options?.find(opt => opt.long === '--provider');
      expect(providerOption?.short).toBe('-p');

      // Check api-key has -k alias
      const apiKeyOption = options?.find(opt => opt.long === '--api-key');
      expect(apiKeyOption?.short).toBe('-k');
    });
  });

  describe('Command parsing', () => {
    it('should parse directory argument correctly', async () => {
      const { renameFiles } = await import('../../../src/cli/rename.js');
      
      setupCommands(program);
      
      await program.parseAsync(['node', 'test', 'rename', '/test/directory'], { from: 'node' });
      
      expect(renameFiles).toHaveBeenCalledWith('/test/directory', expect.any(Object));
    });

    it('should parse options correctly', async () => {
      const { renameFiles } = await import('../../../src/cli/rename.js');
      
      setupCommands(program);
      
      await program.parseAsync([
        'node', 'test', 'rename', '/test/directory',
        '--provider', 'openai',
        '--api-key', 'test-key',
        '--dry-run',
        '--max-size', '20'
      ], { from: 'node' });
      
      expect(renameFiles).toHaveBeenCalledWith('/test/directory', {
        ai: true,
        provider: 'openai',
        apiKey: 'test-key',
        dryRun: true,
        maxSize: '20',
        recursive: false,
        pattern: []
      });
    });

    it('should use default values for options', async () => {
      const { renameFiles } = await import('../../../src/cli/rename.js');
      
      setupCommands(program);
      
      await program.parseAsync(['node', 'test', 'rename', '/test/directory'], { from: 'node' });
      
      const callArgs = vi.mocked(renameFiles).mock.calls[0];
      expect(callArgs[1]).toEqual({
        ai: true,
        dryRun: false,
        recursive: false,
        pattern: []
      });
    });

    it('should handle short option aliases', async () => {
      const { renameFiles } = await import('../../../src/cli/rename.js');

      setupCommands(program);

      await program.parseAsync([
        'node', 'test', 'rename', '/test/directory',
        '-p', 'openai',
        '-k', 'test-key'
      ], { from: 'node' });

      expect(renameFiles).toHaveBeenCalledWith('/test/directory', {
        ai: true,
        provider: 'openai',
        apiKey: 'test-key',
        dryRun: false,
        recursive: false,
        pattern: []
      });
    });
  });

  describe('config command action', () => {
    it('should call configCommand with subcommand, key and value', async () => {
      const { configCommand } = await import('../../../src/cli/config-cmd.js');
      vi.mocked(configCommand).mockResolvedValue(undefined);

      setupCommands(program);
      await program.parseAsync(['node', 'test', 'config', 'set', 'provider', 'openai'], { from: 'node' });

      expect(configCommand).toHaveBeenCalledWith('set', 'provider', 'openai');
    });

    it('should exit with 1 when configCommand throws', async () => {
      const { configCommand } = await import('../../../src/cli/config-cmd.js');
      vi.mocked(configCommand).mockRejectedValue(new Error('config error'));

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      setupCommands(program);
      await program.parseAsync(['node', 'test', 'config', 'list'], { from: 'node' });

      expect(consoleSpy).toHaveBeenCalledWith('Error:', 'config error');
      expect(exitSpy).toHaveBeenCalledWith(1);

      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should show "Unknown error" when configCommand throws a non-Error', async () => {
      const { configCommand } = await import('../../../src/cli/config-cmd.js');
      vi.mocked(configCommand).mockRejectedValue('plain string');

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      setupCommands(program);
      await program.parseAsync(['node', 'test', 'config', 'list'], { from: 'node' });

      expect(consoleSpy).toHaveBeenCalledWith('Error:', 'Unknown error');
      expect(exitSpy).toHaveBeenCalledWith(1);

      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('sanitize command action', () => {
    it('should call sanitizeFiles with directory and options', async () => {
      const { sanitizeFiles } = await import('../../../src/cli/sanitize.js');
      vi.mocked(sanitizeFiles).mockResolvedValue(undefined);

      setupCommands(program);
      await program.parseAsync(['node', 'test', 'sanitize', '/my/dir', '--dry-run', '--recursive', '--case', 'snake_case'], { from: 'node' });

      expect(sanitizeFiles).toHaveBeenCalledWith('/my/dir', { dryRun: true, recursive: true, case: 'snake_case' });
    });

    it('should exit with 1 when sanitizeFiles throws', async () => {
      const { sanitizeFiles } = await import('../../../src/cli/sanitize.js');
      vi.mocked(sanitizeFiles).mockRejectedValue(new Error('sanitize error'));

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      setupCommands(program);
      await program.parseAsync(['node', 'test', 'sanitize'], { from: 'node' });

      expect(consoleSpy).toHaveBeenCalledWith('Error:', 'sanitize error');
      expect(exitSpy).toHaveBeenCalledWith(1);

      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should show "Unknown error" when sanitizeFiles throws a non-Error', async () => {
      const { sanitizeFiles } = await import('../../../src/cli/sanitize.js');
      vi.mocked(sanitizeFiles).mockRejectedValue(42);

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      setupCommands(program);
      await program.parseAsync(['node', 'test', 'sanitize'], { from: 'node' });

      expect(consoleSpy).toHaveBeenCalledWith('Error:', 'Unknown error');
      expect(exitSpy).toHaveBeenCalledWith(1);

      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('apply command action', () => {
    it('should call applyPlan with planPath and options', async () => {
      const { applyPlan } = await import('../../../src/cli/apply.js');
      vi.mocked(applyPlan).mockResolvedValue(undefined);

      setupCommands(program);
      await program.parseAsync(['node', 'test', 'apply', './plan.json', '--dry-run'], { from: 'node' });

      expect(applyPlan).toHaveBeenCalledWith('./plan.json', { dryRun: true });
    });

    it('should exit with 1 when applyPlan throws', async () => {
      const { applyPlan } = await import('../../../src/cli/apply.js');
      vi.mocked(applyPlan).mockRejectedValue(new Error('apply error'));

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      setupCommands(program);
      await program.parseAsync(['node', 'test', 'apply', './plan.json'], { from: 'node' });

      expect(consoleSpy).toHaveBeenCalledWith('Error:', 'apply error');
      expect(exitSpy).toHaveBeenCalledWith(1);

      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should show "Unknown error" when applyPlan throws a non-Error', async () => {
      const { applyPlan } = await import('../../../src/cli/apply.js');
      vi.mocked(applyPlan).mockRejectedValue(null);

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      setupCommands(program);
      await program.parseAsync(['node', 'test', 'apply', './plan.json'], { from: 'node' });

      expect(consoleSpy).toHaveBeenCalledWith('Error:', 'Unknown error');
      expect(exitSpy).toHaveBeenCalledWith(1);

      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('dedup command action', () => {
    it('should call dedupFiles with directory and options', async () => {
      const { dedupFiles } = await import('../../../src/cli/dedup.js');
      vi.mocked(dedupFiles).mockResolvedValue(undefined);

      setupCommands(program);
      await program.parseAsync(['node', 'test', 'dedup', '/my/dir', '--recursive', '--delete'], { from: 'node' });

      expect(dedupFiles).toHaveBeenCalledWith('/my/dir', { recursive: true, delete: true });
    });

    it('should exit with 1 when dedupFiles throws', async () => {
      const { dedupFiles } = await import('../../../src/cli/dedup.js');
      vi.mocked(dedupFiles).mockRejectedValue(new Error('dedup error'));

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      setupCommands(program);
      await program.parseAsync(['node', 'test', 'dedup'], { from: 'node' });

      expect(consoleSpy).toHaveBeenCalledWith('Error:', 'dedup error');
      expect(exitSpy).toHaveBeenCalledWith(1);

      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should show "Unknown error" when dedupFiles throws a non-Error', async () => {
      const { dedupFiles } = await import('../../../src/cli/dedup.js');
      vi.mocked(dedupFiles).mockRejectedValue(undefined);

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      setupCommands(program);
      await program.parseAsync(['node', 'test', 'dedup'], { from: 'node' });

      expect(consoleSpy).toHaveBeenCalledWith('Error:', 'Unknown error');
      expect(exitSpy).toHaveBeenCalledWith(1);

      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('watch command action', () => {
    it('should call watchDirectory with directory and options', async () => {
      const { watchDirectory } = await import('../../../src/cli/watch.js');
      vi.mocked(watchDirectory).mockResolvedValue(undefined);

      setupCommands(program);
      await program.parseAsync(['node', 'test', 'watch', '/my/dir', '--dry-run'], { from: 'node' });

      expect(watchDirectory).toHaveBeenCalledWith('/my/dir', expect.objectContaining({ dryRun: true }));
    });

    it('should call watchDirectory with default directory when none given', async () => {
      const { watchDirectory } = await import('../../../src/cli/watch.js');
      vi.mocked(watchDirectory).mockResolvedValue(undefined);

      setupCommands(program);
      await program.parseAsync(['node', 'test', 'watch'], { from: 'node' });

      expect(watchDirectory).toHaveBeenCalledWith('.', expect.any(Object));
    });

    it('should exit with 1 when watchDirectory throws', async () => {
      const { watchDirectory } = await import('../../../src/cli/watch.js');
      vi.mocked(watchDirectory).mockRejectedValue(new Error('watch error'));

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      setupCommands(program);
      await program.parseAsync(['node', 'test', 'watch'], { from: 'node' });

      expect(consoleSpy).toHaveBeenCalledWith('Error:', 'watch error');
      expect(exitSpy).toHaveBeenCalledWith(1);

      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should show "Unknown error" when watchDirectory throws a non-Error', async () => {
      const { watchDirectory } = await import('../../../src/cli/watch.js');
      vi.mocked(watchDirectory).mockRejectedValue('oops');

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      setupCommands(program);
      await program.parseAsync(['node', 'test', 'watch'], { from: 'node' });

      expect(consoleSpy).toHaveBeenCalledWith('Error:', 'Unknown error');
      expect(exitSpy).toHaveBeenCalledWith(1);

      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('undo command action', () => {
    it('should call undoRename with sessionId and options', async () => {
      const { undoRename } = await import('../../../src/cli/undo.js');
      vi.mocked(undoRename).mockResolvedValue(undefined);

      setupCommands(program);
      await program.parseAsync(['node', 'test', 'undo', 'sess-123', '--list'], { from: 'node' });

      expect(undoRename).toHaveBeenCalledWith('sess-123', { list: true, all: undefined });
    });

    it('should call undoRename with --all flag', async () => {
      const { undoRename } = await import('../../../src/cli/undo.js');
      vi.mocked(undoRename).mockResolvedValue(undefined);

      setupCommands(program);
      await program.parseAsync(['node', 'test', 'undo', '--all'], { from: 'node' });

      expect(undoRename).toHaveBeenCalledWith(undefined, { list: undefined, all: true });
    });

    it('should exit with 1 when undoRename throws', async () => {
      const { undoRename } = await import('../../../src/cli/undo.js');
      vi.mocked(undoRename).mockRejectedValue(new Error('undo error'));

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      setupCommands(program);
      await program.parseAsync(['node', 'test', 'undo'], { from: 'node' });

      expect(consoleSpy).toHaveBeenCalledWith('Error:', 'undo error');
      expect(exitSpy).toHaveBeenCalledWith(1);

      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should show "Unknown error" when undoRename throws a non-Error', async () => {
      const { undoRename } = await import('../../../src/cli/undo.js');
      vi.mocked(undoRename).mockRejectedValue(0);

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      setupCommands(program);
      await program.parseAsync(['node', 'test', 'undo'], { from: 'node' });

      expect(consoleSpy).toHaveBeenCalledWith('Error:', 'Unknown error');
      expect(exitSpy).toHaveBeenCalledWith(1);

      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });
});