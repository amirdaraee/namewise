import { promises as fs } from 'fs';
import path from 'path';
import { appendHistory } from '../utils/history.js';

export async function flattenDirectory(
  directory: string,
  options: { dryRun?: boolean } = {}
): Promise<void> {
  const stat = await fs.stat(directory);
  if (!stat.isDirectory()) throw new Error(`${directory} is not a directory`);

  const dryRun = options.dryRun ?? false;
  const nestedFiles = await findNestedFiles(directory);

  if (nestedFiles.length === 0) {
    console.log('No nested files found.');
    return;
  }

  const moves: Array<{ originalPath: string; newPath: string }> = [];

  for (const filePath of nestedFiles) {
    const destPath = await resolveConflict(directory, path.basename(filePath));
    const rel = path.relative(directory, filePath);
    console.log(`${dryRun ? '[dry-run] ' : ''}${rel} → ${path.basename(destPath)}`);
    if (!dryRun) {
      await fs.rename(filePath, destPath);
      moves.push({ originalPath: filePath, newPath: destPath });
    }
  }

  if (!dryRun && moves.length > 0) {
    await appendHistory({
      id: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      directory: path.resolve(directory),
      dryRun: false,
      renames: moves
    });
  }

  const count = dryRun ? nestedFiles.length : moves.length;
  console.log(`\n${dryRun ? 'Would move' : 'Moved'} ${count} file(s).`);
}

async function findNestedFiles(dir: string): Promise<string[]> {
  const nested: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const subFiles = await collectAllFiles(path.join(dir, entry.name));
      nested.push(...subFiles);
    }
  }
  return nested;
}

async function collectAllFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await collectAllFiles(p));
    else files.push(p);
  }
  return files;
}

async function resolveConflict(dir: string, basename: string): Promise<string> {
  const ext = path.extname(basename);
  const stem = path.basename(basename, ext);
  let candidate = path.join(dir, basename);
  let counter = 1;
  while (await fileExists(candidate)) {
    candidate = path.join(dir, `${stem}-${counter}${ext}`);
    counter++;
  }
  return candidate;
}

async function fileExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}
