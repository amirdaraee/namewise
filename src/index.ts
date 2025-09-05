#!/usr/bin/env node

import { program } from 'commander';
import { setupCommands } from './cli/commands.js';

async function main() {
  program
    .name('namewise')
    .description('🤖 AI-powered CLI tool that intelligently renames files based on their content using Claude or OpenAI')
    .version('0.3.1')
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
  # Basic usage (dry run first - recommended!)
  namewise rename ./documents --dry-run

  # With Claude AI and specific template
  namewise rename ./documents --provider claude --template document --name "john"

  # Movies with auto-detection
  namewise rename ./movies --template auto --case kebab-case

  # OpenAI with custom settings
  namewise rename ./files --provider openai --api-key your-key --max-size 20

🔑 API Keys:
  Set environment variables: CLAUDE_API_KEY or OPENAI_API_KEY
  Or provide via --api-key flag

📖 More info: https://github.com/amirdaraee/namewise#readme
`);

  setupCommands(program);
  
  await program.parseAsync(process.argv);
}

main().catch(console.error);