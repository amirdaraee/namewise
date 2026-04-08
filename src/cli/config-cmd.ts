import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { NamiwiseFileConfig } from '../utils/config-loader.js';

const CONFIG_PATH = path.join(os.homedir(), '.namewise.json');
const VALID_KEYS = new Set<keyof NamiwiseFileConfig>([
  'provider', 'apiKey', 'case', 'template', 'name', 'date',
  'maxSize', 'model', 'baseUrl', 'concurrency', 'recursive', 'depth', 'output', 'dryRun'
]);

async function readConfig(): Promise<NamiwiseFileConfig> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw) as NamiwiseFileConfig;
  } catch {
    return {};
  }
}

async function writeConfig(config: NamiwiseFileConfig): Promise<void> {
  await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

function coerceValue(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  const num = Number(value);
  if (!isNaN(num) && value.trim() !== '') return num;
  return value;
}

export async function configCommand(subcommand: string, key?: string, value?: string): Promise<void> {
  if (subcommand === 'list') {
    const config = await readConfig();
    const entries = Object.entries(config);
    if (entries.length === 0) {
      console.log('No config found in ~/.namewise.json');
      return;
    }
    console.log('~/.namewise.json:');
    for (const [k, v] of entries) {
      console.log(`  ${k}: ${JSON.stringify(v)}`);
    }
    return;
  }

  if (subcommand === 'get') {
    if (!key) throw new Error('Usage: namewise config get <key>');
    if (!VALID_KEYS.has(key as keyof NamiwiseFileConfig)) {
      throw new Error(`Unknown config key: ${key}. Valid keys: ${[...VALID_KEYS].join(', ')}`);
    }
    const config = await readConfig();
    const val = config[key as keyof NamiwiseFileConfig];
    console.log(val !== undefined ? String(val) : '(not set)');
    return;
  }

  if (subcommand === 'set') {
    if (!key || value === undefined) throw new Error('Usage: namewise config set <key> <value>');
    if (!VALID_KEYS.has(key as keyof NamiwiseFileConfig)) {
      throw new Error(`Unknown config key: ${key}. Valid keys: ${[...VALID_KEYS].join(', ')}`);
    }
    const config = await readConfig();
    (config as any)[key] = coerceValue(value);
    await writeConfig(config);
    console.log(`Set ${key} = ${JSON.stringify((config as any)[key])}`);
    return;
  }

  throw new Error(`Unknown subcommand: ${subcommand}. Use: list, get, set`);
}
