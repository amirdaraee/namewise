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
    .option('-t, --template <category>', 'File category template (document|movie|music|series|photo|book|general|auto)', 'general')
    .option('-n, --name <personalName>', 'Personal name to include in filenames')
    .option('-d, --date <format>', 'Date format (YYYY-MM-DD|YYYY|YYYYMMDD|none)', 'none')
    .option('--dry-run', 'Preview changes without renaming files', false)
    .option('--max-size <size>', 'Maximum file size in MB', '10')
    .action(async (directory, options) => {
      await renameFiles(directory, options);
    });
}