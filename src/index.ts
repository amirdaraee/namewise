#!/usr/bin/env node

import { program } from 'commander';
import { setupCommands } from './cli/commands.js';

async function main() {
  program
    .name('namewise')
    .description('AI-powered tool to intelligently rename files based on their content')
    .version('0.3.0');

  setupCommands(program);
  
  await program.parseAsync(process.argv);
}

main().catch(console.error);