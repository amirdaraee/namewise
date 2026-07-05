import { promises as fs } from 'fs';
import path from 'path';
import { computeOrganizeMappings, OrganizeBy } from '../utils/organize.js';
import { recordSession } from '../utils/record-session.js';
import { assertDirectory } from '../utils/assert-directory.js';
import * as ui from '../utils/ui.js';

export async function organizeFiles(
  directory: string,
  options: { by?: OrganizeBy; recursive?: boolean; dryRun?: boolean } = {}
): Promise<void> {
  await assertDirectory(directory);

  const by: OrganizeBy = options.by ?? 'ext';
  const dryRun = options.dryRun ?? false;
  const recursive = options.recursive ?? false;

  const mappings = await computeOrganizeMappings(directory, by, recursive);

  if (mappings.length === 0) {
    ui.info('Nothing to organize.');
    return;
  }

  const moves: Array<{ originalPath: string; newPath: string }> = [];

  for (const { sourcePath, destPath, reason } of mappings) {
    const destDir = path.dirname(destPath);
    if (dryRun) {
      ui.dim(`[dry-run] ${path.basename(sourcePath)} → ${reason}/`);
    } else {
      ui.success(`${path.basename(sourcePath)} → ${reason}/`);
    }
    if (!dryRun) {
      await fs.mkdir(destDir, { recursive: true });
      await fs.rename(sourcePath, destPath);
      moves.push({ originalPath: sourcePath, newPath: destPath });
    }
  }

  if (!dryRun && moves.length > 0) {
    await recordSession(directory, false, moves);
  }

  const count = dryRun ? mappings.length : moves.length;
  ui.info(`\n${dryRun ? 'Would move' : 'Moved'} ${count} file(s).`);
}
