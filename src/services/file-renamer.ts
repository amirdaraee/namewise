import { promises as fs } from 'fs';
import path from 'path';
import { FileInfo, Config, RenameResult, AIProvider, AINameResult, RenameSessionResult } from '../types/index.js';
import { DocumentParserFactory } from '../parsers/factory.js';
import { categorizeFile, applyTemplate } from '../utils/file-templates.js';
import { applyNamingConvention } from '../utils/naming-conventions.js';
import { FileSizeError, UnsupportedTypeError, ParseError, VisionError, NetworkError } from '../errors.js';
import { withRetry, RetryOptions } from '../utils/retry.js';
import { logger } from '../utils/logger.js';

const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.heic', '.webp'
]);

export class FileRenamer {
  // Targets already promised to other files in this batch. fs.access alone
  // can't see them: dry-run never touches the disk, and concurrent live
  // renames race the check — either way two files could claim one target.
  private claimedTargets = new Set<string>();

  constructor(
    private parserFactory: DocumentParserFactory,
    // undefined when noAi is set — the AI paths below are never reached then
    private aiService: AIProvider | undefined,
    private config: Config,
    private retryOptions: RetryOptions = {}
  ) {}

  async renameFiles(
    files: FileInfo[],
    onProgress?: (completed: number, total: number, currentFile: string) => void
  ): Promise<RenameSessionResult> {
    this.claimedTargets.clear();
    const results: RenameResult[] = new Array(files.length);
    let totalInputTokens: number | undefined = undefined;
    let totalOutputTokens: number | undefined = undefined;
    const concurrency = this.config.concurrency ?? 3;
    let completedCount = 0;

    let active = 0;
    const pending: Array<() => void> = [];

    const acquire = (): Promise<void> => {
      if (active < concurrency) { active++; return Promise.resolve(); }
      return new Promise(resolve => pending.push(resolve));
    };

    const release = () => {
      active--;
      if (pending.length > 0) { active++; pending.shift()!(); }
    };

    await Promise.all(files.map(async (file, index) => {
      await acquire();
      try {
        const { result, inputTokens, outputTokens } = await this.renameFile(file);
        results[index] = result;
        if (inputTokens !== undefined) totalInputTokens = (totalInputTokens ?? 0) + inputTokens;
        if (outputTokens !== undefined) totalOutputTokens = (totalOutputTokens ?? 0) + outputTokens;
      } catch (error) {
        logger.error(error, { file: file.path });
        results[index] = {
          originalPath: file.path,
          newPath: file.path,
          suggestedName: file.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unexpected error — see log for details'
        };
      } finally {
        completedCount++;
        onProgress?.(completedCount, files.length, file.name);
        release();
      }
    }));

    return {
      results,
      tokenUsage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens }
    };
  }

  private async renameFile(file: FileInfo): Promise<{ result: RenameResult; inputTokens?: number; outputTokens?: number }> {
    if (file.size > this.config.maxFileSize) {
      throw new FileSizeError(`File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds maximum allowed size (${Math.round(this.config.maxFileSize / 1024 / 1024)}MB)`);
    }

    const parser = this.parserFactory.getParser(file.path);
    if (!parser) {
      throw new UnsupportedTypeError(`No parser available for file type: ${file.extension}`);
    }

    const parseResult = await parser.parse(file.path);
    const { content, imageData } = parseResult;

    // Require content unless this is an image file (imageData replaces content)
    if (!imageData && (!content || content.trim().length === 0)) {
      throw new ParseError('No content could be extracted from the file');
    }

    file.documentMetadata = parseResult.metadata;

    const fileCategory = this.config.templateOptions.category === 'auto'
      ? categorizeFile(file.path, content, file)
      : this.config.templateOptions.category;

    let aiResult: AINameResult;
    if (this.config.noAi) {
      aiResult = { name: await this.buildNameFromMetadata(file), inputTokens: undefined, outputTokens: undefined };
    } else if (imageData) {
      // Image file — attempt vision API; skip with warning on any failure
      try {
        aiResult = await withRetry(() => this.aiService!.generateFileName(
          content, file.name, this.config.namingConvention, fileCategory, file,
          this.config.language, this.config.context, imageData
        ), this.retryOptions);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        throw new VisionError(`Vision not supported: ${msg}`);
      }
    } else {
      aiResult = await withRetry(() => this.aiService!.generateFileName(
        content, file.name, this.config.namingConvention, fileCategory, file,
        this.config.language, this.config.context
      ), this.retryOptions);
    }

    if (!aiResult.name || aiResult.name.trim().length === 0) {
      throw new NetworkError('Failed to generate a filename');
    }

    const coreFileName = aiResult.name;
    const templatedName = applyTemplate(
      coreFileName, fileCategory, this.config.templateOptions, this.config.namingConvention, file
    );

    const newFileName = `${templatedName}${file.extension}`;
    const newPath = path.join(path.dirname(file.path), newFileName);
    const finalPath = newPath === file.path ? newPath : await this.resolveConflict(newPath);

    if (!this.config.dryRun && finalPath !== file.path) {
      await fs.rename(file.path, finalPath);
    }

    return {
      result: {
        originalPath: file.path,
        newPath: finalPath,
        suggestedName: path.basename(finalPath),
        success: true
      },
      inputTokens: aiResult.inputTokens,
      outputTokens: aiResult.outputTokens
    };
  }

  private async buildNameFromMetadata(file: FileInfo): Promise<string> {
    // Image files: try EXIF metadata first
    if (IMAGE_EXTENSIONS.has(file.extension.toLowerCase())) {
      try {
        const exifr = (await import('exifr')).default;
        const exif = await exifr.parse(file.path, {
          pick: ['DateTimeOriginal', 'ImageDescription', 'UserComment']
        });
        if (exif?.ImageDescription?.trim()) return exif.ImageDescription.trim();
        if (exif?.UserComment?.trim()) return exif.UserComment.trim();
        if (exif?.DateTimeOriginal) {
          const d = new Date(exif.DateTimeOriginal);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `photo-${y}-${m}-${day}`;
        }
      } catch {
        // Fall through to filename stem
      }
      return path.basename(file.name, file.extension).replace(/[-_]/g, ' ');
    }

    // Document files: use extracted metadata
    const meta = file.documentMetadata;
    if (meta?.title?.trim()) return meta.title.trim();
    if (meta?.author) {
      const year = meta.creationDate ? meta.creationDate.getFullYear().toString() : '';
      return [meta.author, year].filter(Boolean).join(' ');
    }
    return path.basename(file.name, file.extension).replace(/[-_]/g, ' ');
  }

  /**
   * Build the i-th conflict candidate for a basename. When the name ends with
   * the (convention-formatted) personal name, the counter goes before it so
   * the personal name stays last: bill-2-john, not bill-john-2.
   */
  private conflictCandidate(base: string, i: number): string {
    const personalName = this.config.templateOptions.personalName;
    if (personalName) {
      const formatted = applyNamingConvention(personalName, this.config.namingConvention);
      // Case-insensitive: camelCase/PascalCase re-capitalize the name inside
      // the full filename (reportJohn vs john) — keep the base's own casing.
      if (base.length > formatted.length && base.toLowerCase().endsWith(formatted.toLowerCase())) {
        const stem = base.slice(0, base.length - formatted.length);
        const tail = base.slice(base.length - formatted.length);
        const sep = /[-_]$/.test(stem) ? stem.slice(-1) : '';
        return `${stem}${i}${sep}${tail}`;
      }
    }
    return `${base}-${i}`;
  }

  private async resolveConflict(newPath: string): Promise<string> {
    const ext = path.extname(newPath);
    const dir = path.dirname(newPath);
    const base = path.basename(newPath, ext);

    for (let i = 1; i <= 99; i++) {
      const candidate = i === 1 ? newPath : path.join(dir, `${this.conflictCandidate(base, i)}${ext}`);
      if (this.claimedTargets.has(candidate)) continue;
      // Claim before awaiting: concurrent resolveConflict calls run between
      // awaits, so a synchronous claim is what makes the reservation atomic.
      this.claimedTargets.add(candidate);
      try {
        await fs.access(candidate);
        // exists on disk — leave the (harmless) claim and try the next suffix
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return candidate;
        throw error;
      }
    }

    throw new Error(`Could not find an available filename for: ${path.basename(newPath)} (tried -2 through -99)`);
  }
}
