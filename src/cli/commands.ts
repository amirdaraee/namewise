import { Command } from 'commander';
import { renameFiles } from './rename.js';

export function setupCommands(program: Command): void {
  program
    .command('rename')
    .description('🚀 Rename files in a directory based on their content using AI analysis')
    .argument('<directory>', 'Directory containing files to rename')
    .option('-p, --provider <provider>', 'AI provider (claude|openai|ollama|lmstudio)', 'claude')
    .option('-k, --api-key <key>', 'API key for cloud providers (or set CLAUDE_API_KEY/OPENAI_API_KEY)')
    .option('-c, --case <convention>', 'Naming convention (kebab-case|snake_case|camelCase|PascalCase|lowercase|UPPERCASE)', 'kebab-case')
    .option('-t, --template <category>', 'File category template (document|movie|music|series|photo|book|general|auto)', 'general')
    .option('-n, --name <personalName>', 'Personal name to include in filenames (for document/photo templates)')
    .option('-d, --date <format>', 'Date format to include (YYYY-MM-DD|YYYY|YYYYMMDD|none)', 'none')
    .option('--dry-run', 'Preview changes without actually renaming files (RECOMMENDED first!)', false)
    .option('--max-size <size>', 'Maximum file size in MB to process', '10')
    .option('--base-url <url>', 'Base URL for local LLM providers (default: ollama=http://localhost:11434, lmstudio=http://localhost:1234)')
    .option('--model <name>', 'Model name for local LLM providers (default: ollama=llama3.1, lmstudio=local-model)')
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
  • Set API keys as environment variables for cloud providers
  • Local LLMs (Ollama/LMStudio) require running servers first

🖥️  Local LLM Setup:
  • Ollama: Start with 'ollama serve' (default: http://localhost:11434)
  • LMStudio: Enable local server mode (default: http://localhost:1234)

📝 Examples:
  # Safe preview first
  namewise rename ./documents --dry-run

  # Cloud providers (require API keys)
  namewise rename ./docs --provider claude --template document --name "alice"
  namewise rename ./media --provider openai --template auto

  # Local LLMs (no API key needed)
  namewise rename ./documents --provider ollama --model llama3.1 --dry-run
  namewise rename ./contracts --provider lmstudio --base-url http://localhost:1234
  
  # Custom Ollama setup
  namewise rename ./files --provider ollama --base-url http://192.168.1.100:11434 --model codellama
`)
    .action(async (directory, options) => {
      await renameFiles(directory, options);
    });
}