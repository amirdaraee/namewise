import { promises as fs } from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import { FileInfo, Config, RenameResult, DateFormat } from '../types/index.js';
import { DocumentParserFactory } from '../parsers/factory.js';
import { AIServiceFactory } from '../services/ai-factory.js';
import { FileRenamer } from '../services/file-renamer.js';
import { loadConfig, NamiwiseFileConfig } from '../utils/config-loader.js';
import { recordSession } from '../utils/record-session.js';
import { applyPatterns } from '../utils/pattern-rename.js';
import { applyNamingConvention } from '../utils/naming-conventions.js';
import { collectFiles } from '../utils/fs-collect.js';
import { statToFileInfo } from '../utils/file-info.js';
import { assertDirectory } from '../utils/assert-directory.js';
import {
  applySequence,
  applyPrefix,
  applySuffix,
  applyDateStamp,
  applyStrip,
  applyTruncate
} from '../utils/batch-rename.js';
import * as ui from '../utils/ui.js';
import { createLogger, logger } from '../utils/logger.js';
import { handleCliError } from './handle-cli-error.js';
import {
  RenameOptions,
  resolveProvider,
  resolveApiKey,
  providerRequiresApiKey,
  buildConfig
} from './shared-config.js';

export type { RenameOptions } from './shared-config.js';

export async function renameFiles(directory: string, options: RenameOptions): Promise<void> {
  // Load config early so the logger can respect the `log` setting from config file.
  // Errors here (e.g. invalid JSON) are caught by the outer catch below.
  const fileConfig = await loadConfig(directory);
  const log = createLogger('rename', options.log ?? fileConfig.log ?? false);
  log.session({ command: 'rename', directory, provider: options.provider, dryRun: options.dryRun ?? false });
  try {
    // Validate directory exists
    await assertDirectory(directory);

    // Short-circuit for batch rename flags (no AI needed)
    const hasBatchFlags = options.sequence || options.prefix || options.suffix ||
      options.dateStamp || options.strip || options.truncate;

    if (hasBatchFlags) {
      await runBatchRenames(directory, {
        sequence: options.sequence ?? false,
        sequencePrefix: options.sequencePrefix,
        prefix: options.prefix,
        suffix: options.suffix,
        dateStamp: options.dateStamp,
        dateFormat: options.date as DateFormat | undefined,
        strip: options.strip,
        truncate: options.truncate ? parseInt(options.truncate) : undefined
      }, options.dryRun ?? false, options.recursive ?? false);
      return;
    }

    // Resolve provider, API key (env vars + interactive prompt) and config
    const config = await resolveRenameConfig(options, fileConfig);

    // Initialize services
    const parserFactory = new DocumentParserFactory(config);
    // --no-ai never touches an AI provider, so don't construct one (cloud
    // providers throw without an API key, which --no-ai must not require)
    const aiService = config.noAi
      ? undefined
      : AIServiceFactory.create(config.aiProvider, config.apiKey, config.localLLMConfig);
    const fileRenamer = new FileRenamer(parserFactory, aiService, config);

    // Get files to process
    const files = await getFilesToProcess(
      directory,
      config.supportedExtensions,
      config.recursive,
      config.depth ?? Infinity
    );

    if (files.length === 0) {
      ui.info('No supported files found in the directory.');
      return;
    }

    ui.dim(`Scanning ${path.resolve(directory)}  →  ${files.length} file${files.length === 1 ? '' : 's'} found`);

    if (config.patterns && config.patterns.length > 0) {
      await runPatternRenames(files, config);
      return;
    }

    // Pre-flight token estimate so cloud users see the cost before confirming
    if (!config.noAi) {
      printTokenEstimate(files);
    }

    // Confirm before processing
    if (!config.dryRun && !(await confirmProceed())) {
      ui.info('Cancelled.');
      return;
    }

    const { results, tokenUsage, elapsed } = await processFilesWithProgress(fileRenamer, files);

    const successCount = results.filter(r => r.success).length;
    const failCount    = results.filter(r => !r.success).length;
    const elapsedStr   = elapsed < 1000 ? elapsed + 'ms' : (elapsed / 1000).toFixed(1) + 's';

    ui.success(`${files.length} file${files.length === 1 ? '' : 's'} processed in ${elapsedStr}`);

    displayResults(results, config.dryRun, files, tokenUsage, successCount, failCount, elapsed);

    // When dry run is set as a config default (not an explicit --dry-run flag), offer
    // to apply the already-computed renames so the user doesn't need a second invocation.
    const dryRunFromCli = options.dryRun === true;
    if (config.dryRun && !dryRunFromCli) {
      const applied = await offerToApplyPreview(results, directory, tokenUsage);
      if (applied) return;
    }

    logger.summary({
      total: files.length,
      succeeded: successCount,
      failed: failCount,
      tokenUsage,
      elapsedMs: elapsed
    });

    // Save session to history (~/.namewise/history.json)
    const successfulRenames = results
      .filter(r => r.success && r.originalPath !== r.newPath)
      .map(r => ({ originalPath: r.originalPath, newPath: r.newPath }));

    await recordSession(directory, config.dryRun, successfulRenames, tokenUsage);

    // Write JSON report if --output was provided
    if (config.outputPath) {
      await writeJsonReport(config.outputPath, directory, config.dryRun, results);
    }

  } catch (error) {
    await handleCliError(error, log);
  }
}

/**
 * Resolve provider and API key, prompting interactively for the key when a
 * cloud provider has none configured (env vars are checked first), then build
 * the runtime Config. Only `rename` prompts — `watch` never does.
 */
async function resolveRenameConfig(
  options: RenameOptions,
  fileConfig: NamiwiseFileConfig
): Promise<Config> {
  // Resolve provider (CLI flag > config file > default)
  const provider = resolveProvider(options, fileConfig);
  const aiDisabled = options.ai === false;

  // Get API key for cloud providers only (CLI flag > config file > env vars)
  let apiKey = resolveApiKey(provider, options.apiKey ?? fileConfig.apiKey, aiDisabled);

  if (providerRequiresApiKey(provider, aiDisabled) && !apiKey) {
    const keyPrompt = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: `Enter your ${provider} API key:`,
        mask: '*'
      }
    ]);
    apiKey = keyPrompt.apiKey;
  }

  // Create config (CLI flags override file config which overrides defaults)
  return buildConfig(options, fileConfig, provider, apiKey);
}

/** Print the pre-flight input-token estimate for the files about to be sent to the AI. */
function printTokenEstimate(files: FileInfo[]): void {
  const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.heic', '.webp']);
  const VISION_IMAGE_TOKENS = 1600;       // ~1024px image via vision API
  const PROMPT_OVERHEAD_TOKENS = 300;     // instructions + template guidance
  const MAX_CONTENT_CHARS = 5000;         // content cap sent to the AI
  const estTokens = files.reduce((sum, f) => {
    if (IMAGE_EXT.has(f.extension.toLowerCase())) return sum + VISION_IMAGE_TOKENS;
    return sum + Math.ceil(Math.min(f.size, MAX_CONTENT_CHARS) / 4) + PROMPT_OVERHEAD_TOKENS;
  }, 0);
  ui.dim(`Estimated AI usage: ~${estTokens.toLocaleString('en-US')} input tokens for ${files.length} file${files.length === 1 ? '' : 's'} (cloud providers bill per token)`);
}

/** Ask the user to confirm before renaming files (skipped in dry-run mode). */
async function confirmProceed(): Promise<boolean> {
  const confirm = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'proceed',
      message: 'Proceed with renaming these files?',
      default: false
    }
  ]);
  return confirm.proceed;
}

/**
 * Run the rename pipeline with a \r-overwrite progress bar while suppressing
 * library noise (ora animation is unreliable when pdfjs/canvas blocks the
 * event loop between files).
 *
 * Session-level noise suppression covers the entire rename session so that
 * concurrent PDF parsers (concurrency: 3) cannot race their per-call
 * save/restore and let the pdfjs "TT: undefined function" warning escape.
 */
async function processFilesWithProgress(
  fileRenamer: FileRenamer,
  files: FileInfo[]
): Promise<{
  results: RenameResult[];
  tokenUsage: { inputTokens?: number; outputTokens?: number };
  elapsed: number;
}> {
  const startTime = Date.now();
  let lastProgressLen = 0;

  const origConsoleWarn = console.warn;
  const origConsoleLog  = console.log;
  const origStdoutWrite = process.stdout.write.bind(process.stdout);
  console.warn = () => {};
  console.log  = () => {};
  // Filter stdout writes that match known library noise patterns
  (process.stdout as any).write = (chunk: any, ...args: any[]): boolean => {
    if (typeof chunk === 'string' && /Warning: TT:/.test(chunk)) return true;
    return origStdoutWrite(chunk, ...args);
  };
  ui.suppressStderr();
  const { results, tokenUsage } = await fileRenamer.renameFiles(
    files,
    (completed, total) => {
      const BAR_WIDTH = 28;
      const filled = Math.round((completed / total) * BAR_WIDTH);
      const empty  = BAR_WIDTH - filled;
      const bar    = '█'.repeat(filled) + '░'.repeat(empty);
      const pct    = String(Math.round((completed / total) * 100)).padStart(3);
      const line   = `  [${bar}] ${pct}%  ${completed}/${total}`;
      const pad    = ' '.repeat(Math.max(0, lastProgressLen - line.length));
      origStdoutWrite('\r' + line + pad);
      lastProgressLen = line.length;
    }
  ).finally(() => {
    ui.restoreStderr();
    console.warn = origConsoleWarn;
    console.log  = origConsoleLog;
    (process.stdout as any).write = origStdoutWrite;
  });

  // Clear the progress line
  process.stdout.write('\r' + ' '.repeat(lastProgressLen) + '\r');

  return { results, tokenUsage, elapsed: Date.now() - startTime };
}

/**
 * Offer to apply the previewed renames when dry-run came from the config file
 * (not the CLI flag). Returns true when the renames were applied.
 */
async function offerToApplyPreview(
  results: RenameResult[],
  directory: string,
  tokenUsage: { inputTokens?: number; outputTokens?: number }
): Promise<boolean> {
  const applicableRenames = results.filter(r => r.success && r.originalPath !== r.newPath);
  if (applicableRenames.length === 0) return false;

  const { apply } = await inquirer.prompt([{
    type: 'confirm',
    name: 'apply',
    message: `Apply ${applicableRenames.length} rename${applicableRenames.length === 1 ? '' : 's'}?`,
    default: false
  }]);
  if (!apply) return false;

  for (const result of applicableRenames) {
    await fs.rename(result.originalPath, result.newPath);
  }
  ui.success(`Applied ${applicableRenames.length} rename${applicableRenames.length === 1 ? '' : 's'}.`);
  await recordSession(
    directory,
    false,
    applicableRenames.map(r => ({ originalPath: r.originalPath, newPath: r.newPath })),
    tokenUsage
  );
  return true;
}

/** Write the JSON rename report requested via --output. */
async function writeJsonReport(
  outputPath: string,
  directory: string,
  dryRun: boolean,
  results: RenameResult[]
): Promise<void> {
  const report = {
    timestamp: new Date().toISOString(),
    directory: path.resolve(directory),
    dryRun,
    summary: {
      total: results.length,
      succeeded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    },
    // Absolute paths so `namewise apply` works from any working directory
    results: results.map(r => ({
      ...r,
      originalPath: path.resolve(r.originalPath),
      newPath: path.resolve(r.newPath)
    }))
  };
  try {
    await fs.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');
    ui.success(`Report saved to: ${outputPath}`);
  } catch (err) {
    logger.warn('Failed to write report', { path: outputPath, error: err instanceof Error ? err.message : String(err) });
    ui.warn(`Failed to write report: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

async function getFilesToProcess(
  directory: string,
  supportedExtensions: string[],
  recursive: boolean = false,
  maxDepth: number = Infinity
): Promise<FileInfo[]> {
  const filePaths = await collectFiles(directory, { recursive, maxDepth });
  const files: FileInfo[] = [];

  for (const filePath of filePaths) {
    const extension = path.extname(filePath).toLowerCase();
    if (!supportedExtensions.includes(extension)) continue;
    files.push(await statToFileInfo(filePath));
  }

  return files;
}

// Exported for integration testing only
export { getFilesToProcess as getFilesToProcessForTest };

async function runPatternRenames(files: FileInfo[], config: Config): Promise<void> {
  const renames: Array<{ originalPath: string; newPath: string }> = [];
  let previewCount = 0;

  for (const file of files) {
    const stem = path.basename(file.name, file.extension);
    let newStem = applyPatterns(stem, config.patterns!);
    newStem = applyNamingConvention(newStem, config.namingConvention);
    const newName = newStem + file.extension;

    if (newName === file.name) continue;

    const newPath = path.join(path.dirname(file.path), newName);
    if (config.dryRun) {
      ui.dim(`[dry-run] ${file.name} → ${newName}`);
    } else {
      ui.success(`${file.name} → ${newName}`);
    }

    if (!config.dryRun) {
      await fs.rename(file.path, newPath);
      renames.push({ originalPath: file.path, newPath });
    } else {
      previewCount++;
    }
  }

  if (!config.dryRun && renames.length > 0) {
    await recordSession(path.dirname(files[0].path), false, renames);
  }

  const count = config.dryRun ? previewCount : renames.length;
  ui.info(`\n${config.dryRun ? 'Would rename' : 'Renamed'} ${count} file(s) using pattern(s).`);
}

function displayResults(
  results: RenameResult[],
  dryRun: boolean,
  files: FileInfo[],
  tokenUsage: { inputTokens?: number; outputTokens?: number },
  successCount: number,
  failCount: number,
  elapsed: number
): void {
  const label = dryRun ? 'Preview' : 'Results';
  ui.section(label);

  for (const result of results) {
    ui.fileRow(result);
  }

  ui.renameStats({ elapsed, files, successCount, failCount, tokenUsage, dryRun });
}

export interface BatchRenameFlags {
  sequence?: boolean;
  sequencePrefix?: string;
  prefix?: string;
  suffix?: string;
  dateStamp?: 'created' | 'modified';
  dateFormat?: DateFormat;
  strip?: string;
  truncate?: number;
}

export async function runBatchRenames(
  directory: string,
  flags: BatchRenameFlags,
  dryRun: boolean,
  recursive: boolean
): Promise<void> {
  const filePaths = await collectFiles(directory, { recursive });
  if (filePaths.length === 0) {
    ui.info('No files found.');
    return;
  }

  const renames: Array<{ originalPath: string; newPath: string }> = [];
  let previewCount = 0;
  const total = filePaths.length;

  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i];
    const ext = path.extname(filePath);
    let stem = path.basename(filePath, ext);

    if (flags.sequence) {
      stem = applySequence(i, total, flags.sequencePrefix);
    }
    if (flags.prefix) stem = applyPrefix(stem, flags.prefix);
    if (flags.suffix) stem = applySuffix(stem, flags.suffix);
    if (flags.strip) stem = applyStrip(stem, flags.strip);
    if (flags.truncate) stem = applyTruncate(stem, flags.truncate);
    if (flags.dateStamp) {
      const stat = await fs.stat(filePath);
      const date = flags.dateStamp === 'created' ? stat.birthtime : stat.mtime;
      stem = applyDateStamp(stem, date, flags.dateFormat ?? 'YYYY-MM-DD');
    }

    const newName = stem + ext;
    if (newName === path.basename(filePath)) continue;

    const newPath = path.join(path.dirname(filePath), newName);
    if (dryRun) {
      ui.dim(`[dry-run] ${path.basename(filePath)} → ${newName}`);
    } else {
      ui.success(`${path.basename(filePath)} → ${newName}`);
    }

    if (!dryRun) {
      await fs.rename(filePath, newPath);
      renames.push({ originalPath: filePath, newPath });
    } else {
      previewCount++;
    }
  }

  if (!dryRun && renames.length > 0) {
    await recordSession(directory, false, renames);
  }

  const count = dryRun ? previewCount : renames.length;
  ui.info(`\n${dryRun ? 'Would rename' : 'Renamed'} ${count} file(s).`);
}
