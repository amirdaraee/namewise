import { promises as fs } from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import { findDuplicates } from '../utils/dedup.js';
import { formatBytes } from '../utils/fs-collect.js';
import { assertDirectory } from '../utils/assert-directory.js';
import * as ui from '../utils/ui.js';

export async function dedupFiles(
  directory: string,
  options: { recursive?: boolean; delete?: boolean } = {}
): Promise<void> {
  await assertDirectory(directory);

  ui.dim('Scanning for duplicates…');
  const duplicates = await findDuplicates(directory, options.recursive ?? false);

  if (duplicates.size === 0) {
    ui.info('No duplicate files found.');
    return;
  }

  const sortedGroups = [...duplicates.entries()].map(
    ([hash, paths]) => ({ hash, sortedPaths: [...paths].sort() })
  );

  let totalDuplicates = 0;
  for (const { hash, sortedPaths } of sortedGroups) {
    ui.info(`\nDuplicate group (${hash.slice(0, 8)}):`);
    for (let i = 0; i < sortedPaths.length; i++) {
      const p = sortedPaths[i];
      const fileStat = await fs.stat(p);
      const sizeStr = formatBytes(fileStat.size);
      console.log(`  ${i === 0 ? '[keep]' : '[dupe]'} ${p} (${sizeStr})`);
    }
    totalDuplicates += sortedPaths.length - 1;
  }

  ui.info(`\nFound ${duplicates.size} group(s) with ${totalDuplicates} duplicate(s).`);

  if (!options.delete) return;

  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: `Delete ${totalDuplicates} duplicate(s)? This cannot be undone.`,
    default: false
  }]);

  if (!confirm) {
    ui.info('Cancelled.');
    return;
  }

  let deleted = 0;
  for (const { sortedPaths } of sortedGroups) {
    for (const filePath of sortedPaths.slice(1)) {
      await fs.unlink(filePath);
      ui.success(`Deleted: ${path.basename(filePath)}`);
      deleted++;
    }
  }
  ui.info(`\nDeleted ${deleted} file(s).`);
}
