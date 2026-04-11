import { promises as fs } from 'fs';
import path from 'path';
import { appendHistory } from '../utils/history.js';
import { sanitizeFilename } from '../utils/sanitizer.js';
import { NamingConvention } from '../types/index.js';
import { collectFiles } from '../utils/fs-collect.js';
import * as ui from '../utils/ui.js';

export async function sanitizeFiles(
  directory: string,
  options: { dryRun?: boolean; recursive?: boolean; case?: NamingConvention }
): Promise<void> {
  const stats = await fs.stat(directory);
  if (!stats.isDirectory()) {
    throw new Error(`${directory} is not a directory`);
  }

  const filePaths = await collectFiles(directory, { recursive: options.recursive ?? false });
  if (filePaths.length === 0) {
    ui.info('No files found.');
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
    if (options.dryRun) {
      ui.dim(`[dry-run] ${path.basename(filePath)} → ${newName}`);
    } else {
      ui.success(`${path.basename(filePath)} → ${newName}`);
    }

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
  ui.info(`\n${count} file(s) ${verb}.`);
}

