import { Command } from 'commander';
import { renameFiles } from './rename.js';

export function setupCommands(program: Command): void {
  program
    .command('rename')
    .description('🚀 Rename files in a directory based on their content using AI analysis')
    .argument('<directory>', 'Directory containing files to rename')
    .option('-p, --provider <provider>', 'AI provider (claude|openai)', 'claude')
    .option('-k, --api-key <key>', 'API key for the AI provider (or set CLAUDE_API_KEY/OPENAI_API_KEY)')
    .option('-c, --case <convention>', 'Naming convention (kebab-case|snake_case|camelCase|PascalCase|lowercase|UPPERCASE)', 'kebab-case')
    .option('-t, --template <category>', 'File category template (document|movie|music|series|photo|book|general|auto)', 'general')
    .option('-n, --name <personalName>', 'Personal name to include in filenames (for document/photo templates)')
    .option('-d, --date <format>', 'Date format to include (YYYY-MM-DD|YYYY|YYYYMMDD|none)', 'none')
    .option('--dry-run', 'Preview changes without actually renaming files (RECOMMENDED first!)', false)
    .option('--max-size <size>', 'Maximum file size in MB to process', '10')
    .addHelpText('after', `

🔍 How it works:
  1. Scans directory for supported files (PDF, DOCX, XLSX, TXT, MD, RTF)
  2. Extracts content and metadata from each file
  3. Uses AI to analyze content and generate descriptive names
  4. Applies your chosen template and naming convention
  5. Renames files (or shows preview with --dry-run)

💡 Pro Tips:
  • Always use --dry-run first to preview changes
  • Use 'auto' template for smart file type detection
  • Personal templates work great for documents and photos
  • Set API keys as environment variables for convenience

📝 Examples:
  # Safe preview first
  namewise rename ./documents --dry-run

  # Personal documents with date
  namewise rename ./docs --template document --name "alice" --date YYYY-MM-DD

  # Auto-detect movies/series with year/episode info
  namewise rename ./media --template auto --provider openai

  # Business documents with snake_case
  namewise rename ./contracts --case snake_case --max-size 50
`)
    .action(async (directory, options) => {
      await renameFiles(directory, options);
    });
}