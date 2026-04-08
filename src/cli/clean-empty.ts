import { promises as fs } from 'fs';
import path from 'path';

export async function cleanEmptyDirs(
  directory: string,
  options: { dryRun?: boolean } = {}
): Promise<void> {
  const stat = await fs.stat(directory);
  if (!stat.isDirectory()) throw new Error(`${directory} is not a directory`);

  const dryRun = options.dryRun ?? false;
  const { emptyDirs } = await scan(directory);

  if (emptyDirs.length === 0) {
    console.log('No empty directories found.');
    return;
  }

  for (const dir of emptyDirs) {
    const rel = path.relative(directory, dir);
    console.log(`${dryRun ? '[dry-run] ' : ''}Remove: ${rel}`);
    if (!dryRun) {
      await fs.rmdir(dir);
    }
  }

  const count = emptyDirs.length;
  console.log(`\n${dryRun ? 'Would remove' : 'Removed'} ${count} empty director${count === 1 ? 'y' : 'ies'}.`);
}

interface ScanResult {
  emptyDirs: string[]; // all empty dirs found in subtree (deepest first)
  isEmpty: boolean;    // whether this dir is itself recursively empty
}

async function scan(dir: string): Promise<ScanResult> {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  if (entries.length === 0) {
    return { emptyDirs: [], isEmpty: true };
  }

  const emptyDirs: string[] = [];
  let allChildDirsEmpty = true;
  let hasFiles = false;

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      hasFiles = true;
      continue;
    }
    const subDir = path.join(dir, entry.name);
    const subResult = await scan(subDir);
    emptyDirs.push(...subResult.emptyDirs);
    if (subResult.isEmpty) {
      emptyDirs.push(subDir);
    } else {
      allChildDirsEmpty = false;
    }
  }

  return { emptyDirs, isEmpty: !hasFiles && allChildDirsEmpty };
}
