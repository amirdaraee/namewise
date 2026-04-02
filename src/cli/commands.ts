import { Command } from 'commander';
import { renameFiles } from './rename.js';
import { undoRename } from './undo.js';

export function setupCommands(program: Command): void {
  program
    .command('rename')
    .description('🚀 Rename files in a directory based on their content using AI analysis')
    .argument('[directory]', 'Directory containing files to rename (default: current directory)', '.')
    .option('-p, --provider <provider>', 'AI provider: claude|openai|ollama|lmstudio (default: claude)')
    .option('-k, --api-key <key>', 'API key for cloud providers (or set CLAUDE_API_KEY/ANTHROPIC_API_KEY/OPENAI_API_KEY)')
    .option('-c, --case <convention>', 'Naming convention: kebab-case|snake_case|camelCase|PascalCase|lowercase|UPPERCASE (default: kebab-case)')
    .option('-t, --template <category>', 'File category: document|movie|music|series|photo|book|general|auto (default: general)')
    .option('-n, --name <personalName>', 'Personal name for document/photo templates')
    .option('-d, --date <format>', 'Date format: YYYY-MM-DD|YYYY|YYYYMMDD|none (default: none)')
    .option('--dry-run', 'Preview changes without renaming files (RECOMMENDED first!)', false)
    .option('--max-size <size>', 'Maximum file size in MB (default: 10)')
    .option('--base-url <url>', 'Base URL for local LLM providers')
    .option('--model <name>', 'Model name for local LLM providers')
    .option('-r, --recursive', 'Recursively scan subdirectories', false)
    .option('--depth <n>', 'Maximum recursion depth when using --recursive')
    .option('--concurrency <n>', 'Files to process in parallel (default: 3)')
    .option('--output <path>', 'Save rename report as JSON to this path')
    .addHelpText('after', `

🔍 How it works:
  1. Loads settings from ~/.namewise.json and <dir>/.namewise.json (CLI flags override)
  2. Scans directory for supported files (PDF, DOCX, XLSX, TXT, MD, RTF)
  3. Extracts content and metadata from each file
  4. For scanned PDFs with no text, converts to image for AI vision analysis
  5. Uses AI to analyze content and generate descriptive names
  6. Applies your chosen template and naming convention
  7. Renames files (or shows preview with --dry-run)
  8. Saves session to ~/.namewise/history.json for later undo

💡 Pro Tips:
  • Always use --dry-run first to preview changes
  • Use --recursive to process nested folders
  • Set common options in ~/.namewise.json to avoid repeating flags
  • Use namewise undo to reverse the last rename session
  • Set API keys as environment variables: ANTHROPIC_API_KEY or OPENAI_API_KEY

🖥️  Local LLM Setup:
  • Ollama: Start with 'ollama serve' (default: http://localhost:11434)
  • LMStudio: Enable local server mode (default: http://localhost:1234)

📝 Examples:
  # Current directory (no directory argument needed)
  namewise rename --dry-run
  namewise rename --provider claude --template document --name "alice"

  # Recursive with depth limit
  namewise rename ./projects --recursive --depth 2 --dry-run

  # With concurrency and report output
  namewise rename ./documents --concurrency 5 --output ./report.json

  # Cloud providers (require API keys)
  namewise rename ./docs --provider claude --template document --name "alice"
  namewise rename ./media --provider openai --template auto

  # Local LLMs (no API key needed)
  namewise rename --provider ollama --model llama3.1 --dry-run
  namewise rename ./contracts --provider lmstudio --base-url http://localhost:1234
`)
    .action(async (directory, options) => {
      await renameFiles(directory, options);
    });

  program
    .command('undo')
    .description('↩️  Undo the most recent rename session')
    .argument('[session-id]', 'Session ID to undo (use --list to see IDs)')
    .option('--list', 'List recent rename sessions with their IDs')
    .action(async (sessionId, options) => {
      try {
        await undoRename(sessionId, { list: options.list });
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });
}
