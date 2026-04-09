import { Command } from 'commander';
import { renameFiles } from './rename.js';
import { undoRename } from './undo.js';
import { configCommand } from './config-cmd.js';
import { sanitizeFiles } from './sanitize.js';
import { applyPlan } from './apply.js';
import { dedupFiles } from './dedup.js';
import { watchDirectory } from './watch.js';
import { statsCommand } from './stats.js';
import { treeCommand } from './tree.js';
import { infoCommand } from './info.js';
import { organizeFiles } from './organize.js';
import { flattenDirectory } from './flatten.js';
import { cleanEmptyDirs } from './clean-empty.js';
import { findFiles } from './find.js';
import { diffDirectories } from './diff.js';
import { initCommand } from './init.js';

export function setupCommands(program: Command): void {
  program
    .command('init')
    .description('Set up Namewise for the first time (interactive wizard)')
    .addHelpText('after', `
What init configures:
  Scope      — global (~/.namewise.json) or project (.namewise.json)
  Provider   — claude | openai | ollama | lmstudio
  API key    — stored in config (cloud providers only)
  Base URL   — for local providers (ollama / lmstudio)
  Model      — override the provider default
  Convention — kebab-case, snake_case, camelCase, etc.
  Language   — language for generated filenames (e.g. English, French)
  Dry-run    — always preview before renaming by default
  Your name  — used in document and photo templates

Example:
  namewise init
  # Then run without any flags — saved settings apply automatically:
  namewise rename ./documents
`)
    .action(async () => {
      try { await initCommand(); }
      catch (error) { console.error('Error:', error instanceof Error ? error.message : 'Unknown error'); process.exit(1); }
    });

  program
    .command('rename')
    .description('Rename files in a directory based on their content using AI analysis')
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
    .option('--model <name>', 'Model name to use (overrides provider default)')
    .option('-r, --recursive', 'Recursively scan subdirectories', false)
    .option('--depth <n>', 'Maximum recursion depth when using --recursive')
    .option('--concurrency <n>', 'Files to process in parallel (default: 3)')
    .option('--output <path>', 'Save rename report as JSON to this path')
    .option(
      '--pattern <pattern>',
      'Regex rename pattern (s/find/replace/flags or find:replace); repeatable, skips AI',
      (val: string, prev: string[]) => [...prev, val],
      [] as string[]
    )
    .option('--no-ai', 'Use file metadata instead of AI (no API call required)')
    .option('--sequence', 'Rename files sequentially: 001.ext, 002.ext, … (skips AI)', false)
    .option('--sequence-prefix <prefix>', 'Prefix for sequential rename: prefix-001.ext')
    .option('--prefix <str>', 'Prepend string to all filenames (skips AI)')
    .option('--suffix <str>', 'Append string to all filenames before extension (skips AI)')
    .option('--date-stamp <field>', 'Prepend date to filename: created|modified (skips AI)')
    .option('--strip <pattern>', 'Remove regex pattern from all filenames (skips AI)')
    .option('--truncate <n>', 'Truncate filenames to N characters (skips AI)')
    .option('--language <lang>', 'Language for generated filenames (e.g. English, French, German)')
    .addHelpText('after', `

How it works:
  1. Loads settings from ~/.namewise.json and <dir>/.namewise.json (CLI flags override)
  2. Scans directory for supported files (PDF, DOCX, XLSX, TXT, MD, RTF)
  3. Extracts content and metadata from each file
  4. For scanned PDFs with no text, converts to image for AI vision analysis
  5. Uses AI to analyze content and generate descriptive names
  6. Applies your chosen template and naming convention
  7. Renames files (or shows preview with --dry-run)
  8. Saves session to ~/.namewise/history.json for later undo (includes token usage for cloud providers)
  9. Displays token usage stats (input/output tokens) for Claude and OpenAI; local providers show N/A

Pro Tips:
  - Always use --dry-run first to preview changes
  - Use --recursive to process nested folders
  - Run "namewise init" once to save your API key and preferences
  - Use "namewise undo" to reverse the last rename session
  - Set API keys as environment variables: ANTHROPIC_API_KEY or OPENAI_API_KEY
  - Token counts (input/output) are shown after each session and saved to history for cloud providers

Local LLM Setup:
  Ollama:   start with "ollama serve" (default: http://localhost:11434)
  LMStudio: enable local server mode   (default: http://localhost:1234)

Examples:
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

  # Force output language regardless of document language
  namewise rename ./farsi-docs --language English --dry-run
  namewise rename ./documents --language French

  # Local LLMs (no API key needed)
  namewise rename --provider ollama --model llama3.1 --dry-run
  namewise rename ./contracts --provider lmstudio --base-url http://localhost:1234

Batch Rename (no AI, no API key):
  namewise rename ./photos --sequence --dry-run
  namewise rename ./photos --sequence --sequence-prefix "holiday"
  namewise rename ./exports --prefix "2024-" --dry-run
  namewise rename ./drafts --suffix "-final"
  namewise rename ./docs --date-stamp modified --dry-run
  namewise rename ./downloads --strip "IMG_" --dry-run
  namewise rename ./downloads --truncate 30 --dry-run
`)
    .action(async (directory, options) => {
      await renameFiles(directory, options);
    });

  program
    .command('config')
    .description('Manage persistent config in ~/.namewise.json')
    .argument('<subcommand>', 'list | get | set')
    .argument('[key]', 'Config key name')
    .argument('[value]', 'Value to set (for set subcommand)')
    .action(async (subcommand, key, value) => {
      try {
        await configCommand(subcommand, key, value);
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  program
    .command('sanitize')
    .description('Clean filenames by removing unsafe characters and applying naming convention')
    .argument('[directory]', 'Directory to sanitize (default: current directory)', '.')
    .option('--dry-run', 'Preview changes without renaming', false)
    .option('-r, --recursive', 'Process subdirectories', false)
    .option('-c, --case <convention>', 'Naming convention: kebab-case|snake_case|camelCase|PascalCase|lowercase|UPPERCASE', 'kebab-case')
    .action(async (directory, options) => {
      try {
        await sanitizeFiles(directory, { dryRun: options.dryRun, recursive: options.recursive, case: options.case });
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  program
    .command('apply')
    .description('Apply a saved rename plan produced by --output')
    .argument('<plan>', 'Path to the plan JSON file')
    .option('--dry-run', 'Validate plan without executing renames', false)
    .action(async (planPath, options) => {
      try {
        await applyPlan(planPath, { dryRun: options.dryRun });
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  program
    .command('dedup')
    .description('Find and optionally remove duplicate files by content hash')
    .argument('[directory]', 'Directory to scan (default: current directory)', '.')
    .option('-r, --recursive', 'Scan subdirectories', false)
    .option('--delete', 'Delete duplicates after confirmation', false)
    .action(async (directory, options) => {
      try {
        await dedupFiles(directory, { recursive: options.recursive, delete: options.delete });
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  program
    .command('watch')
    .description('Watch a directory for new files and rename them automatically using AI')
    .argument('[directory]', 'Directory to watch (default: current directory)', '.')
    .option('-p, --provider <provider>', 'AI provider: claude|openai|ollama|lmstudio (default: claude)')
    .option('-k, --api-key <key>', 'API key for cloud providers (or set CLAUDE_API_KEY/ANTHROPIC_API_KEY/OPENAI_API_KEY)')
    .option('-c, --case <convention>', 'Naming convention: kebab-case|snake_case|camelCase|PascalCase|lowercase|UPPERCASE (default: kebab-case)')
    .option('-t, --template <category>', 'File category: document|movie|music|series|photo|book|general|auto (default: general)')
    .option('-n, --name <personalName>', 'Personal name for document/photo templates')
    .option('-d, --date <format>', 'Date format: YYYY-MM-DD|YYYY|YYYYMMDD|none (default: none)')
    .option('--dry-run', 'Preview changes without renaming files', false)
    .option('--max-size <size>', 'Maximum file size in MB (default: 10)')
    .option('--base-url <url>', 'Base URL for local LLM providers')
    .option('--model <name>', 'Model name to use (overrides provider default)')
    .option('-r, --recursive', 'Watch subdirectories', false)
    .option('--depth <n>', 'Maximum recursion depth when using --recursive')
    .option('--concurrency <n>', 'Files to process in parallel (default: 1)')
    .option('--output <path>', 'Save rename report as JSON to this path')
    .option(
      '--pattern <pattern>',
      'Regex rename pattern (s/find/replace/flags or find:replace); repeatable, skips AI',
      (val: string, prev: string[]) => [...prev, val],
      [] as string[]
    )
    .option('--no-ai', 'Use file metadata instead of AI (no API call required)')
    .action(async (directory, options) => {
      try {
        await watchDirectory(directory, options);
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  program
    .command('undo')
    .description('Undo the most recent rename session')
    .argument('[session-id]', 'Session ID to undo (use --list to see IDs)')
    .option('--list', 'List recent rename sessions with their IDs')
    .option('--all', 'Undo all rename sessions')
    .action(async (sessionId, options) => {
      try {
        await undoRename(sessionId, { list: options.list, all: options.all });
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  program
    .command('stats')
    .description('Show storage breakdown by file type')
    .argument('[directory]', 'Directory to analyse (default: current directory)', '.')
    .option('-r, --recursive', 'Include subdirectories', false)
    .action(async (directory, options) => {
      try { await statsCommand(directory, { recursive: options.recursive }); }
      catch (error) { console.error('Error:', error instanceof Error ? error.message : 'Unknown error'); process.exit(1); }
    });

  program
    .command('tree')
    .description('Show directory tree with file sizes')
    .argument('[directory]', 'Directory to display (default: current directory)', '.')
    .option('--depth <n>', 'Maximum depth to display')
    .action(async (directory, options) => {
      try { await treeCommand(directory, { depth: options.depth ? parseInt(options.depth) : undefined }); }
      catch (error) { console.error('Error:', error instanceof Error ? error.message : 'Unknown error'); process.exit(1); }
    });

  program
    .command('info')
    .description('Show metadata for a file or directory')
    .argument('<path>', 'File or directory path')
    .action(async (targetPath) => {
      try { await infoCommand(targetPath); }
      catch (error) { console.error('Error:', error instanceof Error ? error.message : 'Unknown error'); process.exit(1); }
    });

  program
    .command('organize')
    .description('Move files into subfolders by type, date, or size')
    .argument('[directory]', 'Directory to organise (default: current directory)', '.')
    .option('--by <mode>', 'Organisation mode: ext|date|size (default: ext)', 'ext')
    .option('-r, --recursive', 'Include subdirectories', false)
    .option('--dry-run', 'Preview without moving files', false)
    .action(async (directory, options) => {
      try { await organizeFiles(directory, { by: options.by, recursive: options.recursive, dryRun: options.dryRun }); }
      catch (error) { console.error('Error:', error instanceof Error ? error.message : 'Unknown error'); process.exit(1); }
    });

  program
    .command('flatten')
    .description('Move all nested files into the root directory')
    .argument('[directory]', 'Directory to flatten (default: current directory)', '.')
    .option('--dry-run', 'Preview without moving files', false)
    .action(async (directory, options) => {
      try { await flattenDirectory(directory, { dryRun: options.dryRun }); }
      catch (error) { console.error('Error:', error instanceof Error ? error.message : 'Unknown error'); process.exit(1); }
    });

  program
    .command('clean-empty')
    .description('Find and remove empty directories')
    .argument('[directory]', 'Directory to scan (default: current directory)', '.')
    .option('--dry-run', 'Preview without deleting', false)
    .action(async (directory, options) => {
      try { await cleanEmptyDirs(directory, { dryRun: options.dryRun }); }
      catch (error) { console.error('Error:', error instanceof Error ? error.message : 'Unknown error'); process.exit(1); }
    });

  program
    .command('find')
    .description('Search files by name, extension, size, or date')
    .argument('[directory]', 'Directory to search (default: current directory)', '.')
    .option('--ext <ext>', 'Filter by file extension (e.g. pdf)')
    .option('--name <glob>', 'Filter by filename glob (e.g. "*.report*")')
    .option('--larger-than <size>', 'Minimum size (e.g. 5mb, 100kb)')
    .option('--smaller-than <size>', 'Maximum size (e.g. 10mb)')
    .option('--newer-than <date>', 'Modified after date (YYYY-MM-DD)')
    .option('--older-than <date>', 'Modified before date (YYYY-MM-DD)')
    .option('-r, --recursive', 'Search subdirectories', true)
    .action(async (directory, options) => {
      try {
        await findFiles(directory, {
          ext: options.ext,
          name: options.name,
          largerThan: options.largerThan,
          smallerThan: options.smallerThan,
          newerThan: options.newerThan,
          olderThan: options.olderThan,
          recursive: options.recursive
        });
      } catch (error) { console.error('Error:', error instanceof Error ? error.message : 'Unknown error'); process.exit(1); }
    });

  program
    .command('diff')
    .description('Compare two directories')
    .argument('<dir1>', 'First directory')
    .argument('<dir2>', 'Second directory')
    .option('--by <mode>', 'Compare by: name|hash (default: name)', 'name')
    .option('-r, --recursive', 'Compare subdirectories', true)
    .action(async (dir1, dir2, options) => {
      try { await diffDirectories(dir1, dir2, { by: options.by, recursive: options.recursive }); }
      catch (error) { console.error('Error:', error instanceof Error ? error.message : 'Unknown error'); process.exit(1); }
    });
}
