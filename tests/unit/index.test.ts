import { describe, it, expect, vi } from 'vitest';

// vi.mock is hoisted to top, so these mocks apply when index.ts is imported
vi.mock('commander', () => ({
  program: {
    name: vi.fn().mockReturnThis(),
    description: vi.fn().mockReturnThis(),
    version: vi.fn().mockReturnThis(),
    addHelpText: vi.fn().mockReturnThis(),
    parseAsync: vi.fn().mockResolvedValue(undefined)
  }
}));

vi.mock('../../src/cli/commands.js', () => ({
  setupCommands: vi.fn()
}));

import { program } from 'commander';
import { setupCommands } from '../../src/cli/commands.js';

describe('CLI entry point (index.ts)', () => {
  it('should initialize program with correct name, version and setup commands', async () => {
    // Import index.ts to run the main() function
    await import('../../src/index.js');

    expect(program.name).toHaveBeenCalledWith('namewise');
    expect(program.version).toHaveBeenCalledWith('0.3.1');
    expect(setupCommands).toHaveBeenCalledWith(program);
    expect(program.parseAsync).toHaveBeenCalledWith(process.argv);
  });

  it('should call description with AI-powered description', async () => {
    await import('../../src/index.js');

    expect(program.description).toHaveBeenCalledWith(
      expect.stringContaining('AI-powered')
    );
  });

  it('should call addHelpText with supported file types info', async () => {
    await import('../../src/index.js');

    expect(program.addHelpText).toHaveBeenCalledWith(
      'after',
      expect.stringContaining('Supported File Types')
    );
  });
});
