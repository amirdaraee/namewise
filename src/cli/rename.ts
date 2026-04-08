import { promises as fs } from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import { FileInfo, Config, RenameResult, FileCategory, DateFormat } from '../types/index.js';
import { DocumentParserFactory } from '../parsers/factory.js';
import { AIServiceFactory } from '../services/ai-factory.js';
import { FileRenamer } from '../services/file-renamer.js';
import { loadConfig } from '../utils/config-loader.js';
import { appendHistory } from '../utils/history.js';
import { applyPatterns } from '../utils/pattern-rename.js';
import { applyNamingConvention } from '../utils/naming-conventions.js';
import { collectFiles } from '../utils/fs-collect.js';
import {
  applySequence,
  applyPrefix,
  applySuffix,
  applyDateStamp,
  applyStrip,
  applyTruncate
} from '../utils/batch-rename.js';

export async function renameFiles(directory: string, options: any): Promise<void> {
  try {
    // Validate directory exists
    const stats = await fs.stat(directory);
    if (!stats.isDirectory()) {
      throw new Error(`${directory} is not a directory`);
    }

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
        dateFormat: options.date,
        strip: options.strip,
        truncate: options.truncate ? parseInt(options.truncate) : undefined
      }, options.dryRun ?? false, options.recursive ?? false);
      return;
    }

    // Load cascading config file (project overrides user-home)
    const fileConfig = await loadConfig(directory);

    // Resolve provider (CLI flag > config file > default)
    const provider = (options.provider ?? fileConfig.provider ?? 'claude') as Config['aiProvider'];

    // Get API key for cloud providers only
    let apiKey = options.apiKey ?? fileConfig.apiKey;
    const requiresApiKey = ['claude', 'openai'].includes(provider) && options.ai !== false;

    if (requiresApiKey && !apiKey) {
      // Check environment variables first
      if (provider === 'claude' && (process.env.CLAUDE_API_KEY ?? process.env.ANTHROPIC_API_KEY)) {
        apiKey = process.env.CLAUDE_API_KEY ?? process.env.ANTHROPIC_API_KEY;
      } else if (provider === 'openai' && process.env.OPENAI_API_KEY) {
        apiKey = process.env.OPENAI_API_KEY;
      } else {
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
    }

    // Create config (CLI flags override file config which overrides defaults)
    const config: Config = {
      aiProvider: provider,
      apiKey,
      maxFileSize: parseInt(options.maxSize ?? String(fileConfig.maxSize ?? '10')) * 1024 * 1024,
      supportedExtensions: ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.txt', '.md', '.rtf'],
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
      language: options.language ?? fileConfig.language
    };

    // Initialize services
    const parserFactory = new DocumentParserFactory(config);
    const aiService = AIServiceFactory.create(config.aiProvider, apiKey, config.localLLMConfig);
    const fileRenamer = new FileRenamer(parserFactory, aiService, config);

    // Get files to process
    const files = await getFilesToProcess(
      directory,
      config.supportedExtensions,
      config.recursive,
      config.depth ?? Infinity
    );
    
    if (files.length === 0) {
      console.log('No supported files found in the directory.');
      return;
    }

    console.log(`Found ${files.length} files to process:`);
    files.forEach(file => console.log(`  - ${file.name}`));

    if (config.patterns && config.patterns.length > 0) {
      await runPatternRenames(files, config);
      return;
    }

    // Confirm before processing
    if (!config.dryRun) {
      const confirm = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: 'Do you want to proceed with renaming these files?',
          default: false
        }
      ]);

      if (!confirm.proceed) {
        console.log('Operation cancelled.');
        return;
      }
    }

    // Process files
    console.log('\nProcessing files...');
    const startTime = Date.now();
    const results = await fileRenamer.renameFiles(files);

    // Display results
    displayResults(results, config.dryRun, startTime, files);

    // Save session to history (~/.namewise/history.json)
    const successfulRenames = results
      .filter(r => r.success && r.originalPath !== r.newPath)
      .map(r => ({ originalPath: r.originalPath, newPath: r.newPath }));

    await appendHistory({
      id: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      directory: path.resolve(directory),
      dryRun: config.dryRun,
      renames: successfulRenames
    });

    // Write JSON report if --output was provided
    if (config.outputPath) {
      const report = {
        timestamp: new Date().toISOString(),
        directory: path.resolve(directory),
        dryRun: config.dryRun,
        summary: {
          total: results.length,
          succeeded: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        },
        results
      };
      try {
        await fs.writeFile(config.outputPath, JSON.stringify(report, null, 2), 'utf-8');
        console.log(`Report saved to: ${config.outputPath}`);
      } catch (err) {
        console.warn(`Warning: Failed to write report: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

async function getFilesToProcess(
  directory: string,
  supportedExtensions: string[],
  recursive: boolean = false,
  maxDepth: number = Infinity,
  _currentDepth: number = 0
): Promise<FileInfo[]> {
  const files: FileInfo[] = [];
  const entries = await fs.readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory() && recursive && _currentDepth < maxDepth) {
      const subFiles = await getFilesToProcess(
        entryPath, supportedExtensions, recursive, maxDepth, _currentDepth + 1
      );
      files.push(...subFiles);
    } else if (entry.isFile()) {
      const extension = path.extname(entry.name).toLowerCase();

      if (supportedExtensions.includes(extension)) {
        const stats = await fs.stat(entryPath);
        const parentFolder = path.basename(directory);
        const fullPath = path.resolve(entryPath);
        const folderPath = path.dirname(fullPath).split(path.sep).filter(p => p);

        files.push({
          path: entryPath,
          name: entry.name,
          extension,
          size: stats.size,
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime,
          accessedAt: stats.atime,
          parentFolder,
          folderPath: folderPath.slice(-3),
          documentMetadata: undefined
        });
      }
    }
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
    console.log(`${config.dryRun ? '[dry-run] ' : ''}${file.name} → ${newName}`);

    if (!config.dryRun) {
      await fs.rename(file.path, newPath);
      renames.push({ originalPath: file.path, newPath });
    } else {
      previewCount++;
    }
  }

  if (!config.dryRun && renames.length > 0) {
    await appendHistory({
      id: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      directory: path.resolve(path.dirname(files[0].path)),
      dryRun: false,
      renames
    });
  }

  const count = config.dryRun ? previewCount : renames.length;
  console.log(`\n${config.dryRun ? 'Would rename' : 'Renamed'} ${count} file(s) using pattern(s).`);
}

function displayResults(results: RenameResult[], dryRun: boolean, startTime: number, files: FileInfo[]): void {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`\n${dryRun ? 'Preview' : 'Results'}:`);
  console.log(`${successful.length} files ${dryRun ? 'would be' : 'successfully'} renamed`);

  if (failed.length > 0) {
    console.log(`${failed.length} files failed`);
  }

  console.log('\nDetails:');
  results.forEach(result => {
    const status = result.success ? 'OK' : 'FAIL';
    const originalName = path.basename(result.originalPath);
    const newName = path.basename(result.newPath);

    if (result.success) {
      console.log(`[${status}] ${originalName} → ${newName}`);
    } else {
      console.log(`[${status}] ${originalName} (failed)`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    }
  });

  // Stats
  const elapsed = Date.now() - startTime;
  const elapsedStr = elapsed < 1000 ? `${elapsed}ms` : `${(elapsed / 1000).toFixed(1)}s`;
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const totalMB = (totalBytes / 1024 / 1024).toFixed(2);
  const extCounts: Record<string, number> = {};
  for (const f of files) {
    extCounts[f.extension] = (extCounts[f.extension] ?? 0) + 1;
  }
  const extSummary = Object.entries(extCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ext, count]) => `${count} ${ext.slice(1).toUpperCase()}`)
    .join(', ');
  const statsLine = `Stats: ${elapsedStr} elapsed | ${totalMB} MB processed | ${extSummary}`;
  console.log(`\n${statsLine}`);
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
    console.log('No files found.');
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
    console.log(`${dryRun ? '[dry-run] ' : ''}${path.basename(filePath)} → ${newName}`);

    if (!dryRun) {
      await fs.rename(filePath, newPath);
      renames.push({ originalPath: filePath, newPath });
    } else {
      previewCount++;
    }
  }

  if (!dryRun && renames.length > 0) {
    await appendHistory({
      id: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      directory: path.resolve(directory),
      dryRun: false,
      renames
    });
  }

  const count = dryRun ? previewCount : renames.length;
  console.log(`\n${dryRun ? 'Would rename' : 'Renamed'} ${count} file(s).`);
}