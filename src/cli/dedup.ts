import { promises as fs } from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import { findDuplicates } from '../utils/dedup.js';

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export async function dedupFiles(
  directory: string,
  options: { recursive?: boolean; delete?: boolean } = {}
): Promise<void> {
  const stats = await fs.stat(directory);
  if (!stats.isDirectory()) {
    throw new Error(`${directory} is not a directory`);
  }

  console.log('Scanning for duplicates...');
  const duplicates = await findDuplicates(directory, options.recursive ?? false);

  if (duplicates.size === 0) {
    console.log('No duplicate files found.');
    return;
  }

  const sortedGroups = [...duplicates.entries()].map(
    ([hash, paths]) => ({ hash, sortedPaths: [...paths].sort() })
  );

  let totalDuplicates = 0;
  for (const { hash, sortedPaths } of sortedGroups) {
    console.log(`\nDuplicate group (${hash.slice(0, 8)}):`);
    for (let i = 0; i < sortedPaths.length; i++) {
      const p = sortedPaths[i];
      const fileStat = await fs.stat(p);
      const sizeStr = formatBytes(fileStat.size);
      console.log(`  ${i === 0 ? '[keep]' : '[dupe]'} ${p} (${sizeStr})`);
    }
    totalDuplicates += sortedPaths.length - 1;
  }

  console.log(`\nFound ${duplicates.size} group(s) with ${totalDuplicates} duplicate(s).`);

  if (!options.delete) return;

  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: `Delete ${totalDuplicates} duplicate(s)? This cannot be undone.`,
    default: false
  }]);

  if (!confirm) {
    console.log('Cancelled.');
    return;
  }

  let deleted = 0;
  for (const { sortedPaths } of sortedGroups) {
    for (const filePath of sortedPaths.slice(1)) {
      await fs.unlink(filePath);
      console.log(`Deleted: ${path.basename(filePath)}`);
      deleted++;
    }
  }
  console.log(`\nDeleted ${deleted} file(s).`);
}
