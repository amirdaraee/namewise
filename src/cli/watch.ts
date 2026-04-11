import path from 'path';
import { promises as fs } from 'fs';
import chokidar from 'chokidar';
import * as ui from '../utils/ui.js';
import { Config, FileInfo, FileCategory, DateFormat } from '../types/index.js';
import { DocumentParserFactory } from '../parsers/factory.js';
import { AIServiceFactory } from '../services/ai-factory.js';
import { FileRenamer } from '../services/file-renamer.js';
import { loadConfig } from '../utils/config-loader.js';
import { appendHistory } from '../utils/history.js';

export async function watchDirectory(directory: string, options: any): Promise<void> {
  // Validate directory
  const stats = await fs.stat(directory);
  if (!stats.isDirectory()) {
    throw new Error(`${directory} is not a directory`);
  }

  const absDir = path.resolve(directory);

  // Load cascading config file
  const fileConfig = await loadConfig(absDir);

  // Resolve provider
  const provider = (options.provider ?? fileConfig.provider ?? 'claude') as Config['aiProvider'];

  // Get API key for cloud providers
  let apiKey = options.apiKey;
  const requiresApiKey = ['claude', 'openai'].includes(provider) && options.ai !== false;
  if (requiresApiKey && !apiKey) {
    if (provider === 'claude' && (process.env.CLAUDE_API_KEY ?? process.env.ANTHROPIC_API_KEY)) {
      apiKey = process.env.CLAUDE_API_KEY ?? process.env.ANTHROPIC_API_KEY;
    } else if (provider === 'openai' && process.env.OPENAI_API_KEY) {
      apiKey = process.env.OPENAI_API_KEY;
    }
  }

  // Build config (mirrors renameFiles logic)
  const config: Config = {
    aiProvider: provider,
    apiKey,
    maxFileSize: parseInt(options.maxSize ?? String(fileConfig.maxSize ?? '10')) * 1024 * 1024,
    supportedExtensions: new DocumentParserFactory().getSupportedExtensions(),
    dryRun: options.dryRun ?? false,
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
    noAi: options.ai === false
  };

  // Determine supported extensions from the parser factory
  const parserFactory = new DocumentParserFactory(config);
  const supportedExtensions = parserFactory.getSupportedExtensions();

  // Create AI service and renamer once (not per file)
  const aiService = config.noAi ? undefined : AIServiceFactory.create(config.aiProvider, apiKey, config.localLLMConfig);
  const renamer = new FileRenamer(parserFactory, aiService as any, config);

  // Build and start the watcher
  const watcher = chokidar.watch(absDir, {
    ignoreInitial: true,
    persistent: true,
    ignored: (filePath: string) => {
      const ext = path.extname(filePath).toLowerCase();
      // Allow directories (no extension) to pass through so chokidar can recurse
      if (!ext) return false;
      return !supportedExtensions.includes(ext);
    }
  });

  ui.info(`Watching ${absDir} for new files…`);

  // Handle new file events
  watcher.on('add', async (filePath: string) => {
    const fileName = path.basename(filePath);
    ui.dim(`Detected: ${fileName}`);

    try {
      const fileStat = await fs.stat(filePath);
      const extension = path.extname(fileName).toLowerCase();
      const parentFolder = path.basename(path.dirname(filePath));
      const fullPath = path.resolve(filePath);
      const folderPath = path.dirname(fullPath).split(path.sep).filter(p => p);

      const fileInfo: FileInfo = {
        path: filePath,
        name: fileName,
        extension,
        size: fileStat.size,
        createdAt: fileStat.birthtime,
        modifiedAt: fileStat.mtime,
        accessedAt: fileStat.atime,
        parentFolder,
        folderPath: folderPath.slice(-3),
        documentMetadata: undefined
      };

      const { results } = await renamer.renameFiles([fileInfo]);

      const result = results[0];
      if (result?.success && result.newPath !== result.originalPath) {
        const newName = path.basename(result.newPath);
        ui.success(`${fileName}  →  ${newName}`);
        await appendHistory({
          id: new Date().toISOString(),
          timestamp: new Date().toISOString(),
          directory: absDir,
          dryRun: config.dryRun,
          renames: [{ originalPath: result.originalPath, newPath: result.newPath }]
        });
      } else if (result?.success) {
        ui.dim(`No rename needed for: ${fileName}`);
      }
    } catch (error) {
      ui.error(`Error processing ${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // Keep the process alive until shutdown signal
  await new Promise<void>((resolve) => {
    const shutdown = async () => {
      ui.dim('\nStopping watcher…');
      await watcher.close();
      resolve();
    };

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  });
}
