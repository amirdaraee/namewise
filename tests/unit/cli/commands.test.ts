import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Command } from 'commander';
import { setupCommands } from '../../../src/cli/commands.js';

// Mock the rename function to avoid actual execution
vi.mock('../../../src/cli/rename.js', () => ({
  renameFiles: vi.fn()
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
      expect(providerOption?.description).toBe('AI provider (claude|openai|ollama|lmstudio)');
      expect(providerOption?.defaultValue).toBe('claude');

      // Check api-key option
      const apiKeyOption = options?.find(opt => opt.long === '--api-key');
      expect(apiKeyOption).toBeDefined();
      expect(apiKeyOption?.description).toBe('API key for cloud providers (or set CLAUDE_API_KEY/OPENAI_API_KEY)');

      // Check dry-run option
      const dryRunOption = options?.find(opt => opt.long === '--dry-run');
      expect(dryRunOption).toBeDefined();
      expect(dryRunOption?.description).toBe('Preview changes without actually renaming files (RECOMMENDED first!)');
      expect(dryRunOption?.defaultValue).toBe(false);

      // Check max-size option
      const maxSizeOption = options?.find(opt => opt.long === '--max-size');
      expect(maxSizeOption).toBeDefined();
      expect(maxSizeOption?.description).toBe('Maximum file size in MB to process');
      expect(maxSizeOption?.defaultValue).toBe('10');
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
        provider: 'openai',
        apiKey: 'test-key',
        dryRun: true,
        maxSize: '20',
        case: 'kebab-case',
        template: 'general',
        name: undefined,
        date: 'none',
        baseUrl: undefined,
        model: undefined
      });
    });

    it('should use default values for options', async () => {
      const { renameFiles } = await import('../../../src/cli/rename.js');
      
      setupCommands(program);
      
      await program.parseAsync(['node', 'test', 'rename', '/test/directory'], { from: 'node' });
      
      const callArgs = vi.mocked(renameFiles).mock.calls[0];
      expect(callArgs[1]).toEqual({
        provider: 'claude',
        apiKey: undefined,
        dryRun: false,
        maxSize: '10',
        case: 'kebab-case',
        template: 'general',
        name: undefined,
        date: 'none',
        baseUrl: undefined,
        model: undefined
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
        provider: 'openai',
        apiKey: 'test-key',
        dryRun: false,
        maxSize: '10',
        case: 'kebab-case',
        template: 'general',
        name: undefined,
        date: 'none',
        baseUrl: undefined,
        model: undefined
      });
    });
  });
});