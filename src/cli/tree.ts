import { promises as fs } from 'fs';
import path from 'path';
import { formatBytes } from '../utils/fs-collect.js';
import * as ui from '../utils/ui.js';

export async function treeCommand(
  directory: string,
  options: { depth?: number } = {}
): Promise<void> {
  const stat = await fs.stat(directory);
  if (!stat.isDirectory()) throw new Error(`${directory} is not a directory`);

  const maxDepth = options.depth ?? Infinity;
  ui.info(`\n${path.resolve(directory)}`);
  await printTree(directory, '', 0, maxDepth);
}

async function printTree(
  dir: string,
  prefix: string,
  depth: number,
  maxDepth: number
): Promise<void> {
  if (depth >= maxDepth) return;

  const entries = await fs.readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => {
    // Directories first, then alphabetical
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const isLast = i === entries.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = prefix + (isLast ? '    ' : '│   ');
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const summary = await dirSummary(entryPath);
      console.log(`${prefix}${connector}${entry.name}/  (${summary.fileCount} file(s), ${formatBytes(summary.totalBytes)})`);
      await printTree(entryPath, childPrefix, depth + 1, maxDepth);
    } else {
      const stat = await fs.stat(entryPath);
      console.log(`${prefix}${connector}${entry.name}  ${formatBytes(stat.size)}`);
    }
  }
}

async function dirSummary(dir: string): Promise<{ fileCount: number; totalBytes: number }> {
  let fileCount = 0;
  let totalBytes = 0;
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const sub = await dirSummary(p);
        fileCount += sub.fileCount;
        totalBytes += sub.totalBytes;
      } else {
        const stat = await fs.stat(p);
        fileCount++;
        totalBytes += stat.size;
      }
    }
  } catch {
    // permission denied or similar — skip silently
  }
  return { fileCount, totalBytes };
}
