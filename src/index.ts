#!/usr/bin/env node

import { program } from 'commander';
import { setupCommands } from './cli/commands.js';

async function main() {
  program
    .name('namewise')
    .description('🤖 AI-powered CLI tool that intelligently renames, organises, and cleans up files')
    .version('0.7.0')
    .addHelpText('after', `

📋 Supported File Types:
  PDF, DOCX/DOC, XLSX/XLS, TXT, MD, RTF

🎯 File Templates:
  • general    - Simple descriptive names (default)
  • document   - Personal docs with name/date: contract-john-20241205.pdf
  • movie      - Movies with year: the-matrix-1999.mkv
  • series     - TV shows: breaking-bad-s01e01.mkv
  • music      - Music with artist: the-beatles-hey-jude.mp3
  • photo      - Photos with context: vacation-paris-john-20241205.jpg
  • book       - Books with author: george-orwell-1984.pdf
  • auto       - AI auto-detects best template

🔧 Naming Conventions:
  kebab-case, snake_case, camelCase, PascalCase, lowercase, UPPERCASE

💡 Quick Examples:
  # AI rename (dry run first - recommended!)
  namewise rename ./documents --dry-run
  namewise rename ./documents --provider claude --template document --name "john"

  # No AI required
  namewise rename ./docs --no-ai
  namewise rename ./docs --pattern "s/IMG_//i" --pattern "s/ /-/g"

  # Utility commands
  namewise sanitize ./downloads --dry-run
  namewise dedup ./photos --recursive --delete
  namewise watch ./inbox --provider claude
  namewise apply ./plan.json
  namewise config set case snake_case
  namewise undo --list

🔑 API Keys:
  Set environment variables: ANTHROPIC_API_KEY or OPENAI_API_KEY
  Or provide via --api-key flag

📖 More info: https://github.com/amirdaraee/namewise#readme
`);

  setupCommands(program);
  
  await program.parseAsync(process.argv);
}

main().catch(console.error);