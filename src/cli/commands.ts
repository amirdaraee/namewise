import { Command } from 'commander';
import { renameFiles } from './rename.js';

export function setupCommands(program: Command): void {
  program
    .command('rename')
    .description('Rename files in a directory based on their content')
    .argument('<directory>', 'Directory containing files to rename')
    .option('-p, --provider <provider>', 'AI provider (claude|openai)', 'claude')
    .option('-k, --api-key <key>', 'API key for the AI provider')
    .option('-c, --case <convention>', 'Naming convention (kebab-case|snake_case|camelCase|PascalCase|lowercase|UPPERCASE)', 'kebab-case')
    .option('--dry-run', 'Preview changes without renaming files', false)
    .option('--max-size <size>', 'Maximum file size in MB', '10')
    .action(async (directory, options) => {
      await renameFiles(directory, options);
    });
}