import { promises as fs } from 'fs';
import path from 'path';
import { FileInfo, Config, RenameResult, AIProvider } from '../types/index.js';
import { DocumentParserFactory } from '../parsers/factory.js';
import { categorizeFile, applyTemplate } from '../utils/file-templates.js';

export class FileRenamer {
  constructor(
    private parserFactory: DocumentParserFactory,
    private aiService: AIProvider,
    private config: Config
  ) {}

  async renameFiles(files: FileInfo[]): Promise<RenameResult[]> {
    const results: RenameResult[] = new Array(files.length);
    const concurrency = this.config.concurrency ?? 3;
    let completedCount = 0;
    let lastProgressLength = 0;
    let progressChain = Promise.resolve();

    let active = 0;
    const pending: Array<() => void> = [];

    const acquire = (): Promise<void> => {
      if (active < concurrency) {
        active++;
        return Promise.resolve();
      }
      return new Promise(resolve => pending.push(resolve));
    };

    const release = () => {
      active--;
      if (pending.length > 0) {
        active++;
        pending.shift()!();
      }
    };

    await Promise.all(files.map(async (file, index) => {
      await acquire();
      try {
        results[index] = await this.renameFile(file);
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
        const count = completedCount;
        const truncatedName = file.name.length > 50 ? file.name.substring(0, 47) + '...' : file.name;
        const msg = `🔄 Processing [${count}/${files.length}] ${truncatedName}`;
        progressChain = progressChain.then(() => {
          const clearLine = '\r' + ' '.repeat(Math.max(lastProgressLength, msg.length)) + '\r';
          process.stdout.write(clearLine + msg);
          lastProgressLength = msg.length;
        });
        release();
      }
    }));

    await progressChain;

    const clearFinal = '\r' + ' '.repeat(lastProgressLength) + '\r';
    if (files.length > 0) {
      const successCount = results.filter(r => r.success).length;
      const completionMessage = `✅ Processed ${files.length} file${files.length === 1 ? '' : 's'} (${successCount} successful)`;
      process.stdout.write(clearFinal + completionMessage + '\n');
    } else {
      process.stdout.write(clearFinal);
    }

    return results;
  }

  private async renameFile(file: FileInfo): Promise<RenameResult> {
    // Check file size
    if (file.size > this.config.maxFileSize) {
      throw new Error(`File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds maximum allowed size (${Math.round(this.config.maxFileSize / 1024 / 1024)}MB)`);
    }

    // Get appropriate parser
    const parser = this.parserFactory.getParser(file.path);
    if (!parser) {
      throw new Error(`No parser available for file type: ${file.extension}`);
    }

    // Extract content and metadata
    const parseResult = await parser.parse(file.path);
    const content = parseResult.content;
    if (!content || content.trim().length === 0) {
      throw new Error('No content could be extracted from the file');
    }
    
    // Update file info with extracted document metadata
    file.documentMetadata = parseResult.metadata;

    // Determine file category (use configured category or auto-categorize)
    const fileCategory = this.config.templateOptions.category === 'auto' 
      ? categorizeFile(file.path, content, file)
      : this.config.templateOptions.category;

    // Generate core filename using AI (or metadata if --no-ai)
    const coreFileName = this.config.noAi
      ? this.buildNameFromMetadata(file)
      : await this.aiService.generateFileName(content, file.name, this.config.namingConvention, fileCategory, file);
    if (!coreFileName || coreFileName.trim().length === 0) {
      throw new Error('Failed to generate a filename');
    }

    // Apply template to include personal info, dates, etc.
    const templatedName = applyTemplate(
      coreFileName,
      fileCategory,
      this.config.templateOptions,
      this.config.namingConvention,
      file
    );

    // Create new filename with original extension
    const newFileName = `${templatedName}${file.extension}`;
    const newPath = path.join(path.dirname(file.path), newFileName);

    // Resolve final path, auto-numbering if target already exists
    const finalPath = newPath === file.path ? newPath : await this.resolveConflict(newPath);

    // Perform the rename (or simulate if dry run)
    if (!this.config.dryRun && finalPath !== file.path) {
      await fs.rename(file.path, finalPath);
    }

    return {
      originalPath: file.path,
      newPath: finalPath,
      suggestedName: path.basename(finalPath),
      success: true
    };
  }

  private buildNameFromMetadata(file: FileInfo): string {
    const meta = file.documentMetadata;
    if (meta?.title?.trim()) {
      return meta.title.trim();
    }
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