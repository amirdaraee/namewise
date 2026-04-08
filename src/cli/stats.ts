import { promises as fs } from 'fs';
import path from 'path';
import { computeStats } from '../utils/stats.js';
import { formatBytes } from '../utils/fs-collect.js';

export async function statsCommand(
  directory: string,
  options: { recursive?: boolean } = {}
): Promise<void> {
  const stat = await fs.stat(directory);
  if (!stat.isDirectory()) throw new Error(`${directory} is not a directory`);

  const stats = await computeStats(directory, options.recursive ?? false);

  if (stats.totalFiles === 0) {
    console.log('No files found.');
    return;
  }

  const absDir = path.resolve(directory);
  console.log(`\nDirectory: ${absDir}`);
  console.log(`Total: ${stats.totalFiles} file(s) · ${formatBytes(stats.totalBytes)}\n`);

  console.log('By type:');
  for (const t of stats.byType) {
    const pct = stats.totalBytes > 0
      ? ` (${Math.round((t.bytes / stats.totalBytes) * 100)}%)`
      : '';
    const extLabel = t.ext.padEnd(12);
    const countLabel = `${t.count} file(s)`.padEnd(12);
    const sizeLabel = formatBytes(t.bytes).padStart(10);
    console.log(`  ${extLabel} ${countLabel} ${sizeLabel}${pct}`);
  }

  if (stats.largest.length > 0) {
    console.log('\nLargest files:');
    for (const f of stats.largest.slice(0, 5)) {
      const name = path.relative(directory, f.path);
      console.log(`  ${name.padEnd(40)} ${formatBytes(f.bytes)}`);
    }
  }
}
