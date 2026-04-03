import { promises as fs } from 'fs';
import path from 'path';
import { appendHistory } from '../utils/history.js';
import { sanitizeFilename } from '../utils/sanitizer.js';
import { NamingConvention } from '../types/index.js';

export async function sanitizeFiles(
  directory: string,
  options: { dryRun?: boolean; recursive?: boolean; case?: NamingConvention }
): Promise<void> {
  const stats = await fs.stat(directory);
  if (!stats.isDirectory()) {
    throw new Error(`${directory} is not a directory`);
  }

  const filePaths = await collectFiles(directory, options.recursive ?? false);
  if (filePaths.length === 0) {
    console.log('No files found.');
    return;
  }

  const convention = options.case ?? 'kebab-case';
  const renames: Array<{ originalPath: string; newPath: string }> = [];
  let previewCount = 0;

  for (const filePath of filePaths) {
    const ext = path.extname(filePath);
    const stem = path.basename(filePath, ext);
    const sanitized = sanitizeFilename(stem, convention);
    const newName = sanitized + ext;

    if (newName === path.basename(filePath)) continue;

    const newPath = path.join(path.dirname(filePath), newName);
    console.log(`${options.dryRun ? '[dry-run] ' : ''}${path.basename(filePath)} → ${newName}`);

    if (!options.dryRun) {
      await fs.rename(filePath, newPath);
      renames.push({ originalPath: filePath, newPath });
    } else {
      previewCount++;
    }
  }

  if (!options.dryRun && renames.length > 0) {
    await appendHistory({
      id: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      directory: path.resolve(directory),
      dryRun: false,
      renames
    });
  }

  const count = options.dryRun ? previewCount : renames.length;
  const verb = options.dryRun ? 'would be sanitized' : 'sanitized';
  console.log(`\nDone: ${count} file(s) ${verb}.`);
}

async function collectFiles(dir: string, recursive: boolean): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory() && recursive) {
      files.push(...await collectFiles(entryPath, recursive));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}
