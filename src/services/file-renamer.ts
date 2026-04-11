import { promises as fs } from 'fs';
import path from 'path';
import { FileInfo, Config, RenameResult, AIProvider, AINameResult, RenameSessionResult } from '../types/index.js';
import { DocumentParserFactory } from '../parsers/factory.js';
import { categorizeFile, applyTemplate } from '../utils/file-templates.js';

const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.heic', '.webp'
]);

export class FileRenamer {
  constructor(
    private parserFactory: DocumentParserFactory,
    private aiService: AIProvider,
    private config: Config
  ) {}

  async renameFiles(
    files: FileInfo[],
    onProgress?: (completed: number, total: number, currentFile: string) => void
  ): Promise<RenameSessionResult> {
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
        results[index] = {
          originalPath: file.path,
          newPath: file.path,
          suggestedName: file.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
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
      throw new Error(`File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds maximum allowed size (${Math.round(this.config.maxFileSize / 1024 / 1024)}MB)`);
    }

    const parser = this.parserFactory.getParser(file.path);
    if (!parser) {
      throw new Error(`No parser available for file type: ${file.extension}`);
    }

    const parseResult = await parser.parse(file.path);
    const { content, imageData } = parseResult;

    // Require content unless this is an image file (imageData replaces content)
    if (!imageData && (!content || content.trim().length === 0)) {
      throw new Error('No content could be extracted from the file');
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
        aiResult = await this.aiService.generateFileName(
          content, file.name, this.config.namingConvention, fileCategory, file,
          this.config.language, this.config.context, imageData
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Vision not supported: ${msg}`);
      }
    } else {
      aiResult = await this.aiService.generateFileName(
        content, file.name, this.config.namingConvention, fileCategory, file,
        this.config.language, this.config.context
      );
    }

    if (!aiResult.name || aiResult.name.trim().length === 0) {
      throw new Error('Failed to generate a filename');
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

  private async resolveConflict(newPath: string): Promise<string> {
    const ext = path.extname(newPath);
    const base = path.join(path.dirname(newPath), path.basename(newPath, ext));

    try {
      await fs.access(newPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return newPath;
      throw error;
    }

    for (let i = 2; i <= 99; i++) {
      const candidate = `${base}-${i}${ext}`;
      try {
        await fs.access(candidate);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return candidate;
        throw error;
      }
    }

    throw new Error(`Could not find an available filename for: ${path.basename(newPath)} (tried -2 through -99)`);
  }
}
