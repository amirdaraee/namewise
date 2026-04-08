import { promises as fs } from 'fs';
import path from 'path';
import { computeOrganizeMappings, OrganizeBy } from '../utils/organize.js';
import { appendHistory } from '../utils/history.js';

export async function organizeFiles(
  directory: string,
  options: { by?: OrganizeBy; recursive?: boolean; dryRun?: boolean } = {}
): Promise<void> {
  const stat = await fs.stat(directory);
  if (!stat.isDirectory()) throw new Error(`${directory} is not a directory`);

  const by: OrganizeBy = options.by ?? 'ext';
  const dryRun = options.dryRun ?? false;
  const recursive = options.recursive ?? false;

  const mappings = await computeOrganizeMappings(directory, by, recursive);

  if (mappings.length === 0) {
    console.log('Nothing to organize.');
    return;
  }

  const moves: Array<{ originalPath: string; newPath: string }> = [];

  for (const { sourcePath, destPath, reason } of mappings) {
    const destDir = path.dirname(destPath);
    console.log(`${dryRun ? '[dry-run] ' : ''}${path.basename(sourcePath)} → ${reason}/`);
    if (!dryRun) {
      await fs.mkdir(destDir, { recursive: true });
      await fs.rename(sourcePath, destPath);
      moves.push({ originalPath: sourcePath, newPath: destPath });
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

  const count = dryRun ? mappings.length : moves.length;
  console.log(`\n${dryRun ? 'Would move' : 'Moved'} ${count} file(s).`);
}
