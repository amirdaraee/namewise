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

/**
 * Whether the provider needs an API key. 9Router runs locally but still
 * authenticates with its own issued key, separate from the upstream provider
 * keys it holds.
 */
export function providerRequiresApiKey(
  provider: Config['aiProvider'],
  aiDisabled: boolean
): boolean {
  return ['claude', 'openai', '9router'].includes(provider) && !aiDisabled;
}

/** Environment variable each key-taking provider reads. */
const PROVIDER_KEY_ENV: Partial<Record<Config['aiProvider'], string>> = {
  claude: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  '9router': 'NINEROUTER_API_KEY'
};

export function apiKeyEnvVar(provider: Config['aiProvider']): string | undefined {
  return PROVIDER_KEY_ENV[provider];
}

/**
 * The key in .namewise.json belongs to the provider it was configured for.
 * Returning it for a different provider would send, say, an Anthropic key to
 * whatever gateway `--base-url` names — a local listener could simply keep it.
 *
 * A config with no `provider` is treated as claude, matching resolveProvider's
 * default. `ignoredFrom` names the provider a withheld key was stored for so
 * the caller can explain itself instead of failing to authenticate silently.
 */
export function resolveStoredApiKey(
  fileConfig: NamiwiseFileConfig,
  provider: Config['aiProvider']
): { apiKey?: string; ignoredFrom?: Config['aiProvider'] } {
  if (!fileConfig.apiKey) return {};
  const storedFor = fileConfig.provider ?? 'claude';
  if (storedFor === provider) return { apiKey: fileConfig.apiKey };
  return { ignoredFrom: storedFor };
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
  } else if (provider === '9router' && process.env.NINEROUTER_API_KEY) {
    // Not 9ROUTER_API_KEY: POSIX environment variable names cannot begin with
    // a digit, so that spelling is unusable in a shell.
    return process.env.NINEROUTER_API_KEY;
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
