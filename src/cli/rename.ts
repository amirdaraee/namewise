import { promises as fs } from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import { FileInfo, Config, RenameResult } from '../types/index.js';
import { DocumentParserFactory } from '../parsers/factory.js';
import { AIServiceFactory } from '../services/ai-factory.js';
import { FileRenamer } from '../services/file-renamer.js';

export async function renameFiles(directory: string, options: any): Promise<void> {
  try {
    // Validate directory exists
    const stats = await fs.stat(directory);
    if (!stats.isDirectory()) {
      throw new Error(`${directory} is not a directory`);
    }

    // Get API key
    let apiKey = options.apiKey;
    if (!apiKey) {
      const keyPrompt = await inquirer.prompt([
        {
          type: 'password',
          name: 'apiKey',
          message: `Enter your ${options.provider} API key:`,
          mask: '*'
        }
      ]);
      apiKey = keyPrompt.apiKey;
    }

    // Create config
    const config: Config = {
      aiProvider: options.provider,
      apiKey,
      maxFileSize: parseInt(options.maxSize) * 1024 * 1024, // Convert MB to bytes
      supportedExtensions: ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.txt'],
      dryRun: options.dryRun
    };

    // Initialize services
    const parserFactory = new DocumentParserFactory();
    const aiService = AIServiceFactory.create(config.aiProvider, apiKey);
    const fileRenamer = new FileRenamer(parserFactory, aiService, config);

    // Get files to process
    const files = await getFilesToProcess(directory, config.supportedExtensions);
    
    if (files.length === 0) {
      console.log('No supported files found in the directory.');
      return;
    }

    console.log(`Found ${files.length} files to process:`);
    files.forEach(file => console.log(`  - ${file.name}`));

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
    console.log('\\nProcessing files...');
    const results = await fileRenamer.renameFiles(files);

    // Display results
    displayResults(results, config.dryRun);

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

async function getFilesToProcess(directory: string, supportedExtensions: string[]): Promise<FileInfo[]> {
  const files: FileInfo[] = [];
  const entries = await fs.readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile()) {
      const filePath = path.join(directory, entry.name);
      const extension = path.extname(entry.name).toLowerCase();
      
      if (supportedExtensions.includes(extension)) {
        const stats = await fs.stat(filePath);
        files.push({
          path: filePath,
          name: entry.name,
          extension,
          size: stats.size
        });
      }
    }
  }

  return files;
}

function displayResults(results: RenameResult[], dryRun: boolean): void {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`\\n${dryRun ? 'Preview' : 'Results'}:`);
  console.log(`✅ ${successful.length} files ${dryRun ? 'would be' : 'successfully'} renamed`);
  
  if (failed.length > 0) {
    console.log(`❌ ${failed.length} files failed`);
  }

  console.log('\\nDetails:');
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    const originalName = path.basename(result.originalPath);
    const newName = path.basename(result.newPath);
    
    console.log(`${status} ${originalName} ${dryRun ? '→' : '✅'} ${newName}`);
    
    if (!result.success && result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
}