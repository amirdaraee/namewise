import path from 'path';
import chokidar from 'chokidar';
import * as ui from '../utils/ui.js';
import { Config } from '../types/index.js';
import { DocumentParserFactory } from '../parsers/factory.js';
import { AIServiceFactory } from '../services/ai-factory.js';
import { FileRenamer } from '../services/file-renamer.js';
import { loadConfig } from '../utils/config-loader.js';
import { recordSession } from '../utils/record-session.js';
import { assertDirectory } from '../utils/assert-directory.js';
import { statToFileInfo } from '../utils/file-info.js';
import { WatchOptions, resolveProvider, resolveApiKey, buildConfig } from './shared-config.js';

export type { WatchOptions } from './shared-config.js';

export async function watchDirectory(directory: string, options: WatchOptions): Promise<void> {
  // Validate directory
  await assertDirectory(directory);

  const absDir = path.resolve(directory);

  // Load cascading config file
  const fileConfig = await loadConfig(absDir);

  // Resolve provider
  const provider = resolveProvider(options, fileConfig);

  // Get API key for cloud providers. Unlike `rename`, watch never prompts for
  // a missing key and does not read an apiKey from the config file.
  const apiKey = resolveApiKey(provider, options.apiKey, options.ai === false);

  // Build config (shared with renameFiles)
  const config: Config = {
    ...buildConfig(options, fileConfig, provider, apiKey),
    // watch historically ignores the config-file dryRun default and the
    // language/context settings — preserve that behaviour.
    dryRun: options.dryRun ?? false,
    language: undefined,
    context: undefined
  };

  // Determine supported extensions from the parser factory
  const parserFactory = new DocumentParserFactory(config);
  const supportedExtensions = parserFactory.getSupportedExtensions();

  // Create AI service and renamer once (not per file)
  const aiService = config.noAi ? undefined : AIServiceFactory.create(config.aiProvider, apiKey, config.localLLMConfig);
  const renamer = new FileRenamer(parserFactory, aiService, config);

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
      const fileInfo = await statToFileInfo(filePath);

      const { results } = await renamer.renameFiles([fileInfo]);

      const result = results[0];
      if (result?.success && result.newPath !== result.originalPath) {
        const newName = path.basename(result.newPath);
        ui.success(`${fileName}  →  ${newName}`);
        await recordSession(absDir, config.dryRun, [
          { originalPath: result.originalPath, newPath: result.newPath }
        ]);
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
