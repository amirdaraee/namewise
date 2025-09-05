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
    const results: RenameResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Use \r to overwrite the same line, show progress counter
      process.stdout.write(`\rProcessing: ${file.name}... (${i + 1}/${files.length})`);
      
      try {
        const result = await this.renameFile(file);
        results.push(result);
      } catch (error) {
        results.push({
          originalPath: file.path,
          newPath: file.path,
          suggestedName: file.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Clear the processing line and move to next line
    process.stdout.write('\r' + ' '.repeat(80) + '\r');

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

    // Generate core filename using AI with all available metadata
    const coreFileName = await this.aiService.generateFileName(
      content, 
      file.name, 
      this.config.namingConvention, 
      fileCategory,
      file // Pass the entire file info with all metadata
    );
    if (!coreFileName || coreFileName.trim().length === 0) {
      throw new Error('AI service failed to generate a filename');
    }

    // Apply template to include personal info, dates, etc.
    const templatedName = applyTemplate(
      coreFileName,
      fileCategory,
      this.config.templateOptions,
      this.config.namingConvention
    );

    // Create new filename with original extension
    const newFileName = `${templatedName}${file.extension}`;
    const newPath = path.join(path.dirname(file.path), newFileName);

    // Check if new filename would conflict with existing file
    if (newPath !== file.path) {
      await this.checkForConflicts(newPath);
    }

    // Perform the rename (or simulate if dry run)
    if (!this.config.dryRun && newPath !== file.path) {
      await fs.rename(file.path, newPath);
    }

    return {
      originalPath: file.path,
      newPath,
      suggestedName: newFileName,
      success: true
    };
  }

  private async checkForConflicts(newPath: string): Promise<void> {
    try {
      await fs.access(newPath);
      // If we reach here, the file exists
      throw new Error(`Target filename already exists: ${path.basename(newPath)}`);
    } catch (error) {
      // If the error is ENOENT (file doesn't exist), that's what we want
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}