import { promises as fs } from 'fs';
import path from 'path';

export interface CollectOptions {
  recursive?: boolean;
  maxDepth?: number;
}

export async function collectFiles(
  dir: string,
  options: CollectOptions = {}
): Promise<string[]> {
  const { recursive = false, maxDepth = Infinity } = options;
  return _collect(dir, recursive, maxDepth, 0);
}

async function _collect(
  dir: string,
  recursive: boolean,
  maxDepth: number,
  depth: number
): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory() && recursive && depth < maxDepth) {
      files.push(...await _collect(entryPath, recursive, maxDepth, depth + 1));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}
