import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import inquirer from 'inquirer';
import type { NamiwiseFileConfig } from '../utils/config-loader.js';

const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
  claude: 'claude-sonnet-4-5-20250929',
  openai: 'gpt-4o',
  ollama: 'llama3.1',
  lmstudio: 'local-model'
};

const PROVIDER_DEFAULT_URLS: Record<string, string> = {
  ollama: 'http://localhost:11434',
  lmstudio: 'http://localhost:1234'
};

export async function initCommand(): Promise<void> {
  console.log('\nWelcome to Namewise! Let\'s set up your configuration.\n');

  const { scope } = await inquirer.prompt([{
    type: 'list',
    name: 'scope',
    message: 'Where should we save this config?',
    choices: [
      { name: 'Global — applies everywhere  (~/.namewise.json)', value: 'global' },
      { name: 'Project — this directory only  (./.namewise.json)', value: 'project' }
    ]
  }]);

  const configPath = scope === 'global'
    ? path.join(os.homedir(), '.namewise.json')
    : path.join(process.cwd(), '.namewise.json');

  // Check for existing config
  let existing: NamiwiseFileConfig = {};
  try {
    const raw = await fs.readFile(configPath, 'utf-8');
    existing = JSON.parse(raw) as NamiwiseFileConfig;
    const { overwrite } = await inquirer.prompt([{
      type: 'confirm',
      name: 'overwrite',
      message: `Config already exists at ${configPath}. Overwrite?`,
      default: false
    }]);
    if (!overwrite) {
      console.log('Init cancelled.');
      return;
    }
  } catch {
    // no existing config — proceed
  }

  const { provider } = await inquirer.prompt([{
    type: 'list',
    name: 'provider',
    message: 'Which AI provider would you like to use by default?',
    choices: ['claude', 'openai', 'ollama', 'lmstudio'],
    default: existing.provider ?? 'claude'
  }]);

  const config: NamiwiseFileConfig = { provider };

  // API key for cloud providers
  if (provider === 'claude' || provider === 'openai') {
    const label = provider === 'claude' ? 'Anthropic' : 'OpenAI';
    const { apiKey } = await inquirer.prompt([{
      type: 'password',
      name: 'apiKey',
      message: `Enter your ${label} API key:`,
      mask: '*'
    }]);
    if (apiKey) config.apiKey = apiKey;
  }

  // Base URL for local providers
  if (provider === 'ollama' || provider === 'lmstudio') {
    const defaultUrl = PROVIDER_DEFAULT_URLS[provider];
    const { baseUrl } = await inquirer.prompt([{
      type: 'input',
      name: 'baseUrl',
      message: `Base URL for ${provider}:`,
      default: existing.baseUrl ?? defaultUrl
    }]);
    if (baseUrl && baseUrl !== defaultUrl) config.baseUrl = baseUrl;
  }

  // Model
  const defaultModel = PROVIDER_DEFAULT_MODELS[provider];
  const { model } = await inquirer.prompt([{
    type: 'input',
    name: 'model',
    message: `Model (leave blank for default: ${defaultModel}):`,
    default: existing.model ?? ''
  }]);
  if (model) config.model = model;

  // Naming convention
  const { namingConvention } = await inquirer.prompt([{
    type: 'list',
    name: 'namingConvention',
    message: 'Default naming convention for renamed files:',
    choices: ['kebab-case', 'snake_case', 'camelCase', 'PascalCase', 'lowercase', 'UPPERCASE'],
    default: existing.case ?? 'kebab-case'
  }]);
  config.case = namingConvention;

  // Dry run by default
  const { dryRun } = await inquirer.prompt([{
    type: 'confirm',
    name: 'dryRun',
    message: 'Always preview before renaming (dry-run by default)?',
    default: existing.dryRun ?? true
  }]);
  if (dryRun) config.dryRun = true;

  // Personal name
  const { personalName } = await inquirer.prompt([{
    type: 'input',
    name: 'personalName',
    message: 'Your name (used in document/photo templates, optional):',
    default: existing.name ?? ''
  }]);
  if (personalName) config.name = personalName;

  // Write config
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

  console.log(`\nConfig saved to ${configPath}`);
  console.log('\nYou\'re all set! Try:');
  if (config.dryRun) {
    console.log('  namewise rename ./documents');
  } else {
    console.log('  namewise rename ./documents --dry-run');
  }
  console.log('  namewise --help');
}
