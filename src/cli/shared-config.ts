import { Config, FileCategory, DateFormat } from '../types/index.js';
import { NamiwiseFileConfig } from '../utils/config-loader.js';
import { DocumentParserFactory } from '../parsers/factory.js';

/**
 * CLI options shared by the `rename` and `watch` subcommands, as parsed by
 * Commander. Numeric flags arrive as strings (`--max-size 10` → `'10'`).
 */
export interface SharedRenameOptions {
  provider?: string;
  apiKey?: string;
  case?: string;
  template?: string;
  name?: string;
  date?: string;
  dryRun?: boolean;
  maxSize?: string;
  baseUrl?: string;
  model?: string;
  recursive?: boolean;
  depth?: string;
  concurrency?: string;
  output?: string;
  pattern?: string | string[];
  /** Commander sets `ai: false` when --no-ai is passed. */
  ai?: boolean;
  log?: boolean;
  language?: string;
  context?: string;
}

/** Options for the `rename` subcommand (adds the batch-rename flags). */
export interface RenameOptions extends SharedRenameOptions {
  sequence?: boolean;
  sequencePrefix?: string;
  prefix?: string;
  suffix?: string;
  dateStamp?: 'created' | 'modified';
  strip?: string;
  truncate?: string;
}

/** Options for the `watch` subcommand. */
export type WatchOptions = SharedRenameOptions;

/** Resolve the AI provider: CLI flag > config file > default (claude). */
export function resolveProvider(
  options: SharedRenameOptions,
  fileConfig: NamiwiseFileConfig
): Config['aiProvider'] {
  return (options.provider ?? fileConfig.provider ?? 'claude') as Config['aiProvider'];
}

/** Whether the provider needs an API key (cloud providers, unless --no-ai). */
export function providerRequiresApiKey(
  provider: Config['aiProvider'],
  aiDisabled: boolean
): boolean {
  return ['claude', 'openai'].includes(provider) && !aiDisabled;
}

/**
 * Resolve the API key for a provider. Returns `initialKey` unchanged when it
 * is set or when no key is required; otherwise falls back to the environment
 * (CLAUDE_API_KEY/ANTHROPIC_API_KEY for claude, OPENAI_API_KEY for openai).
 *
 * Never prompts — `rename` layers its interactive prompt on top of this,
 * `watch` deliberately does not.
 */
export function resolveApiKey(
  provider: Config['aiProvider'],
  initialKey: string | undefined,
  aiDisabled: boolean
): string | undefined {
  if (!providerRequiresApiKey(provider, aiDisabled) || initialKey) {
    return initialKey;
  }
  if (provider === 'claude') {
    const envKey = process.env.CLAUDE_API_KEY ?? process.env.ANTHROPIC_API_KEY;
    if (envKey) return envKey;
  } else if (provider === 'openai' && process.env.OPENAI_API_KEY) {
    return process.env.OPENAI_API_KEY;
  }
  return initialKey;
}

/**
 * Build the runtime Config from CLI options and the cascading file config
 * (CLI flags override file config which overrides defaults). Shared by
 * `rename` and `watch`, which previously each copy-pasted this literal.
 */
export function buildConfig(
  options: SharedRenameOptions,
  fileConfig: NamiwiseFileConfig,
  provider: Config['aiProvider'],
  apiKey: string | undefined
): Config {
  return {
    aiProvider: provider,
    apiKey,
    maxFileSize: parseInt(options.maxSize ?? String(fileConfig.maxSize ?? '10')) * 1024 * 1024,
    supportedExtensions: new DocumentParserFactory().getSupportedExtensions(),
    dryRun: options.dryRun ?? fileConfig.dryRun ?? false,
    namingConvention: (options.case ?? fileConfig.case ?? 'kebab-case') as Config['namingConvention'],
    templateOptions: {
      category: (options.template ?? fileConfig.template ?? 'general') as FileCategory,
      personalName: options.name ?? fileConfig.name,
      dateFormat: (options.date ?? fileConfig.date ?? 'none') as DateFormat
    },
    localLLMConfig: {
      baseUrl: options.baseUrl ?? fileConfig.baseUrl,
      model: options.model ?? fileConfig.model
    },
    recursive: options.recursive ?? fileConfig.recursive ?? false,
    depth: options.depth !== undefined ? parseInt(options.depth) : fileConfig.depth,
    concurrency: parseInt(options.concurrency ?? String(fileConfig.concurrency ?? '3')),
    outputPath: options.output ?? fileConfig.output,
    patterns: Array.isArray(options.pattern) ? options.pattern : (options.pattern ? [options.pattern] : []),
    noAi: options.ai === false,
    language: options.language ?? fileConfig.language,
    context: options.context ?? fileConfig.context
  };
}
