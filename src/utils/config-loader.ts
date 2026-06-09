import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import * as ui from './ui.js';

export interface NamiwiseFileConfig {
  provider?: 'claude' | 'openai' | 'ollama' | 'lmstudio';
  apiKey?: string;
  case?: string;
  template?: string;
  name?: string;
  date?: string;
  maxSize?: number;
  model?: string;
  baseUrl?: string;
  concurrency?: number;
  recursive?: boolean;
  depth?: number;
  output?: string;
  dryRun?: boolean;
  language?: string;
  context?: string;
  log?: boolean;
}

async function readConfigFile(filePath: string): Promise<NamiwiseFileConfig> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    try {
      return JSON.parse(raw) as NamiwiseFileConfig;
    } catch (parseError) {
      throw new Error(`Invalid JSON in config file ${filePath}: ${(parseError as SyntaxError).message}`, { cause: parseError });
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
}

export async function loadConfig(targetDir: string): Promise<NamiwiseFileConfig> {
  const userConfig = await readConfigFile(path.join(os.homedir(), '.namewise.json'));
  const projectConfig = await readConfigFile(path.join(path.resolve(targetDir), '.namewise.json'));
  if (projectConfig.apiKey) {
    ui.warn('API key found in project-level .namewise.json — one `git add .` away from a leak. Prefer ~/.namewise.json or the ANTHROPIC_API_KEY/OPENAI_API_KEY env vars.');
  }
  return { ...userConfig, ...projectConfig };
}
