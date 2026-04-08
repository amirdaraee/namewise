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

vi.mock('../../../src/cli/init.js', () => ({ initCommand: vi.fn() }));
vi.mock('../../../src/cli/stats.js', () => ({ statsCommand: vi.fn() }));
vi.mock('../../../src/cli/tree.js', () => ({ treeCommand: vi.fn() }));
vi.mock('../../../src/cli/info.js', () => ({ infoCommand: vi.fn() }));
vi.mock('../../../src/cli/organize.js', () => ({ organizeFiles: vi.fn() }));
vi.mock('../../../src/cli/flatten.js', () => ({ flattenDirectory: vi.fn() }));
vi.mock('../../../src/cli/clean-empty.js', () => ({ cleanEmptyDirs: vi.fn() }));
vi.mock('../../../src/cli/find.js', () => ({ findFiles: vi.fn() }));
vi.mock('../../../src/cli/diff.js', () => ({ diffDirectories: vi.fn() }));

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
      expect(renameCommand?.description()).toBe('Rename files in a directory based on their content using AI analysis');
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
      
      expect(renameFiles).toHaveBeenCalledWith('/test/directory', expect.objectContaining({
        ai: true,
        provider: 'openai',
        apiKey: 'test-key',
        dryRun: true,
        maxSize: '20',
        recursive: false,
        pattern: []
      }));
    });

    it('should use default values for options', async () => {
      const { renameFiles } = await import('../../../src/cli/rename.js');
      
      setupCommands(program);
      
      await program.parseAsync(['node', 'test', 'rename', '/test/directory'], { from: 'node' });
      
      const callArgs = vi.mocked(renameFiles).mock.calls[0];
      expect(callArgs[1]).toEqual(expect.objectContaining({
        ai: true,
        dryRun: false,
        recursive: false,
        pattern: []
      }));
    });

    it('should handle short option aliases', async () => {
      const { renameFiles } = await import('../../../src/cli/rename.js');

      setupCommands(program);

      await program.parseAsync([
        'node', 'test', 'rename', '/test/directory',
        '-p', 'openai',
        '-k', 'test-key'
      ], { from: 'node' });

      expect(renameFiles).toHaveBeenCalledWith('/test/directory', expect.objectContaining({
        ai: true,
        provider: 'openai',
        apiKey: 'test-key',
        dryRun: false,
        recursive: false,
        pattern: []
      }));
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

  describe('init command action', () => {
    it('should call initCommand', async () => {
      const { initCommand } = await import('../../../src/cli/init.js');
      vi.mocked(initCommand).mockResolvedValue(undefined);
      setupCommands(program);
      await program.parseAsync(['node', 'test', 'init'], { from: 'node' });
      expect(initCommand).toHaveBeenCalled();
    });

    it('should exit with 1 when initCommand throws', async () => {
      const { initCommand } = await import('../../../src/cli/init.js');
      vi.mocked(initCommand).mockRejectedValue(new Error('init error'));
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      setupCommands(program);
      await program.parseAsync(['node', 'test', 'init'], { from: 'node' });
      expect(consoleSpy).toHaveBeenCalledWith('Error:', 'init error');
      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore(); consoleSpy.mockRestore();
    });

    it('should show "Unknown error" when initCommand throws a non-Error', async () => {
      const { initCommand } = await import('../../../src/cli/init.js');
      vi.mocked(initCommand).mockRejectedValue('oops');
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      setupCommands(program);
      await program.parseAsync(['node', 'test', 'init'], { from: 'node' });
      expect(consoleSpy).toHaveBeenCalledWith('Error:', 'Unknown error');
      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore(); consoleSpy.mockRestore();
    });
  });

  describe('stats command action', () => {
    it('should call statsCommand with directory and options', async () => {
      const { statsCommand } = await import('../../../src/cli/stats.js');
      vi.mocked(statsCommand).mockResolvedValue(undefined);
      setupCommands(program);
      await program.parseAsync(['node', 'test', 'stats', '/my/dir', '--recursive'], { from: 'node' });
      expect(statsCommand).toHaveBeenCalledWith('/my/dir', { recursive: true });
    });

    it('should exit with 1 when statsCommand throws', async () => {
      const { statsCommand } = await import('../../../src/cli/stats.js');
      vi.mocked(statsCommand).mockRejectedValue(new Error('stats error'));
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      setupCommands(program);
      await program.parseAsync(['node', 'test', 'stats'], { from: 'node' });
      expect(consoleSpy).toHaveBeenCalledWith('Error:', 'stats error');
      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('tree command action', () => {
    it('should call treeCommand with directory and depth', async () => {
      const { treeCommand } = await import('../../../src/cli/tree.js');
      vi.mocked(treeCommand).mockResolvedValue(undefined);
      setupCommands(program);
      await program.parseAsync(['node', 'test', 'tree', '/my/dir', '--depth', '3'], { from: 'node' });
      expect(treeCommand).toHaveBeenCalledWith('/my/dir', { depth: 3 });
    });

    it('should call treeCommand without depth when not specified', async () => {
      const { treeCommand } = await import('../../../src/cli/tree.js');
      vi.mocked(treeCommand).mockResolvedValue(undefined);
      setupCommands(program);
      await program.parseAsync(['node', 'test', 'tree', '/my/dir'], { from: 'node' });
      expect(treeCommand).toHaveBeenCalledWith('/my/dir', { depth: undefined });
    });

    it('should exit with 1 when treeCommand throws', async () => {
      const { treeCommand } = await import('../../../src/cli/tree.js');
      vi.mocked(treeCommand).mockRejectedValue(new Error('tree error'));
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      setupCommands(program);
      await program.parseAsync(['node', 'test', 'tree'], { from: 'node' });
      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('info command action', () => {
    it('should call infoCommand with path', async () => {
      const { infoCommand } = await import('../../../src/cli/info.js');
      vi.mocked(infoCommand).mockResolvedValue(undefined);
      setupCommands(program);
      await program.parseAsync(['node', 'test', 'info', '/my/file.pdf'], { from: 'node' });
      expect(infoCommand).toHaveBeenCalledWith('/my/file.pdf');
    });

    it('should exit with 1 when infoCommand throws', async () => {
      const { infoCommand } = await import('../../../src/cli/info.js');
      vi.mocked(infoCommand).mockRejectedValue(new Error('info error'));
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      setupCommands(program);
      await program.parseAsync(['node', 'test', 'info', '/my/file.pdf'], { from: 'node' });
      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('organize command action', () => {
    it('should call organizeFiles with directory and options', async () => {
      const { organizeFiles } = await import('../../../src/cli/organize.js');
      vi.mocked(organizeFiles).mockResolvedValue(undefined);
      setupCommands(program);
      await program.parseAsync(['node', 'test', 'organize', '/my/dir', '--by', 'date', '--dry-run'], { from: 'node' });
      expect(organizeFiles).toHaveBeenCalledWith('/my/dir', { by: 'date', recursive: false, dryRun: true });
    });

    it('should exit with 1 when organizeFiles throws', async () => {
      const { organizeFiles } = await import('../../../src/cli/organize.js');
      vi.mocked(organizeFiles).mockRejectedValue(new Error('organize error'));
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      setupCommands(program);
      await program.parseAsync(['node', 'test', 'organize'], { from: 'node' });
      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('flatten command action', () => {
    it('should call flattenDirectory with directory and dryRun', async () => {
      const { flattenDirectory } = await import('../../../src/cli/flatten.js');
      vi.mocked(flattenDirectory).mockResolvedValue(undefined);
      setupCommands(program);
      await program.parseAsync(['node', 'test', 'flatten', '/my/dir', '--dry-run'], { from: 'node' });
      expect(flattenDirectory).toHaveBeenCalledWith('/my/dir', { dryRun: true });
    });

    it('should exit with 1 when flattenDirectory throws', async () => {
      const { flattenDirectory } = await import('../../../src/cli/flatten.js');
      vi.mocked(flattenDirectory).mockRejectedValue(new Error('flatten error'));
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      setupCommands(program);
      await program.parseAsync(['node', 'test', 'flatten'], { from: 'node' });
      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('clean-empty command action', () => {
    it('should call cleanEmptyDirs with directory and dryRun', async () => {
      const { cleanEmptyDirs } = await import('../../../src/cli/clean-empty.js');
      vi.mocked(cleanEmptyDirs).mockResolvedValue(undefined);
      setupCommands(program);
      await program.parseAsync(['node', 'test', 'clean-empty', '/my/dir', '--dry-run'], { from: 'node' });
      expect(cleanEmptyDirs).toHaveBeenCalledWith('/my/dir', { dryRun: true });
    });

    it('should exit with 1 when cleanEmptyDirs throws', async () => {
      const { cleanEmptyDirs } = await import('../../../src/cli/clean-empty.js');
      vi.mocked(cleanEmptyDirs).mockRejectedValue(new Error('clean error'));
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      setupCommands(program);
      await program.parseAsync(['node', 'test', 'clean-empty'], { from: 'node' });
      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('find command action', () => {
    it('should call findFiles with directory and filter options', async () => {
      const { findFiles } = await import('../../../src/cli/find.js');
      vi.mocked(findFiles).mockResolvedValue(undefined);
      setupCommands(program);
      await program.parseAsync(['node', 'test', 'find', '/my/dir', '--ext', 'pdf', '--larger-than', '1mb'], { from: 'node' });
      expect(findFiles).toHaveBeenCalledWith('/my/dir', expect.objectContaining({ ext: 'pdf', largerThan: '1mb' }));
    });

    it('should exit with 1 when findFiles throws', async () => {
      const { findFiles } = await import('../../../src/cli/find.js');
      vi.mocked(findFiles).mockRejectedValue(new Error('find error'));
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      setupCommands(program);
      await program.parseAsync(['node', 'test', 'find'], { from: 'node' });
      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('new command "Unknown error" branches', () => {
    const exitAndConsole = () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      return { exitSpy, consoleSpy };
    };

    it('stats: shows "Unknown error" on non-Error throw', async () => {
      const { statsCommand } = await import('../../../src/cli/stats.js');
      vi.mocked(statsCommand).mockRejectedValue('oops');
      const { exitSpy, consoleSpy } = exitAndConsole();
      setupCommands(program);
      await program.parseAsync(['node', 'test', 'stats'], { from: 'node' });
      expect(consoleSpy).toHaveBeenCalledWith('Error:', 'Unknown error');
      exitSpy.mockRestore(); consoleSpy.mockRestore();
    });

    it('tree: shows "Unknown error" on non-Error throw', async () => {
      const { treeCommand } = await import('../../../src/cli/tree.js');
      vi.mocked(treeCommand).mockRejectedValue(42);
      const { exitSpy, consoleSpy } = exitAndConsole();
      setupCommands(program);
      await program.parseAsync(['node', 'test', 'tree'], { from: 'node' });
      expect(consoleSpy).toHaveBeenCalledWith('Error:', 'Unknown error');
      exitSpy.mockRestore(); consoleSpy.mockRestore();
    });

    it('info: shows "Unknown error" on non-Error throw', async () => {
      const { infoCommand } = await import('../../../src/cli/info.js');
      vi.mocked(infoCommand).mockRejectedValue(null);
      const { exitSpy, consoleSpy } = exitAndConsole();
      setupCommands(program);
      await program.parseAsync(['node', 'test', 'info', '/f'], { from: 'node' });
      expect(consoleSpy).toHaveBeenCalledWith('Error:', 'Unknown error');
      exitSpy.mockRestore(); consoleSpy.mockRestore();
    });

    it('organize: shows "Unknown error" on non-Error throw', async () => {
      const { organizeFiles } = await import('../../../src/cli/organize.js');
      vi.mocked(organizeFiles).mockRejectedValue(undefined);
      const { exitSpy, consoleSpy } = exitAndConsole();
      setupCommands(program);
      await program.parseAsync(['node', 'test', 'organize'], { from: 'node' });
      expect(consoleSpy).toHaveBeenCalledWith('Error:', 'Unknown error');
      exitSpy.mockRestore(); consoleSpy.mockRestore();
    });

    it('flatten: shows "Unknown error" on non-Error throw', async () => {
      const { flattenDirectory } = await import('../../../src/cli/flatten.js');
      vi.mocked(flattenDirectory).mockRejectedValue(0);
      const { exitSpy, consoleSpy } = exitAndConsole();
      setupCommands(program);
      await program.parseAsync(['node', 'test', 'flatten'], { from: 'node' });
      expect(consoleSpy).toHaveBeenCalledWith('Error:', 'Unknown error');
      exitSpy.mockRestore(); consoleSpy.mockRestore();
    });

    it('clean-empty: shows "Unknown error" on non-Error throw', async () => {
      const { cleanEmptyDirs } = await import('../../../src/cli/clean-empty.js');
      vi.mocked(cleanEmptyDirs).mockRejectedValue('fail');
      const { exitSpy, consoleSpy } = exitAndConsole();
      setupCommands(program);
      await program.parseAsync(['node', 'test', 'clean-empty'], { from: 'node' });
      expect(consoleSpy).toHaveBeenCalledWith('Error:', 'Unknown error');
      exitSpy.mockRestore(); consoleSpy.mockRestore();
    });

    it('find: shows "Unknown error" on non-Error throw', async () => {
      const { findFiles } = await import('../../../src/cli/find.js');
      vi.mocked(findFiles).mockRejectedValue({});
      const { exitSpy, consoleSpy } = exitAndConsole();
      setupCommands(program);
      await program.parseAsync(['node', 'test', 'find'], { from: 'node' });
      expect(consoleSpy).toHaveBeenCalledWith('Error:', 'Unknown error');
      exitSpy.mockRestore(); consoleSpy.mockRestore();
    });

    it('diff: shows "Unknown error" on non-Error throw', async () => {
      const { diffDirectories } = await import('../../../src/cli/diff.js');
      vi.mocked(diffDirectories).mockRejectedValue(false);
      const { exitSpy, consoleSpy } = exitAndConsole();
      setupCommands(program);
      await program.parseAsync(['node', 'test', 'diff', '/a', '/b'], { from: 'node' });
      expect(consoleSpy).toHaveBeenCalledWith('Error:', 'Unknown error');
      exitSpy.mockRestore(); consoleSpy.mockRestore();
    });
  });

  describe('diff command action', () => {
    it('should call diffDirectories with both dirs and options', async () => {
      const { diffDirectories } = await import('../../../src/cli/diff.js');
      vi.mocked(diffDirectories).mockResolvedValue(undefined);
      setupCommands(program);
      await program.parseAsync(['node', 'test', 'diff', '/dir1', '/dir2', '--by', 'hash'], { from: 'node' });
      expect(diffDirectories).toHaveBeenCalledWith('/dir1', '/dir2', { by: 'hash', recursive: true });
    });

    it('should exit with 1 when diffDirectories throws', async () => {
      const { diffDirectories } = await import('../../../src/cli/diff.js');
      vi.mocked(diffDirectories).mockRejectedValue(new Error('diff error'));
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      setupCommands(program);
      await program.parseAsync(['node', 'test', 'diff', '/dir1', '/dir2'], { from: 'node' });
      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });
});