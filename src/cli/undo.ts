import { promises as fs } from 'fs';
import path from 'path';
import { readHistory, appendHistory, HistoryEntry } from '../utils/history.js';

export async function undoRename(
  sessionId?: string,
  options: { list?: boolean } = {}
): Promise<void> {
  if (options.list) {
    const history = await readHistory();
    const recent = history.slice(-10).reverse();
    if (recent.length === 0) {
      console.log('No rename history found.');
      return;
    }
    console.log('Recent rename sessions:');
    recent.forEach(entry => {
      const label = entry.dryRun ? ' [dry-run]' : '';
      console.log(`  ${entry.id}${label} — ${entry.renames.length} file(s) in ${entry.directory}`);
    });
    return;
  }

  const history = await readHistory();
  let entry: HistoryEntry | undefined;

  if (sessionId) {
    entry = history.find(e => e.id === sessionId);
    if (!entry) throw new Error(`Session not found: ${sessionId}`);
  } else {
    entry = [...history].reverse().find(e => !e.dryRun);
    if (!entry) {
      console.log('No undo-able rename sessions found.');
      return;
    }
  }

  if (entry.dryRun) {
    console.log(`Session ${entry.id} was a dry run — nothing to undo.`);
    return;
  }

  const reversed = [...entry.renames].reverse();
  let succeeded = 0;
  let skipped = 0;

  for (const rename of reversed) {
    try {
      await fs.access(rename.newPath);
      await fs.rename(rename.newPath, rename.originalPath);
      console.log(`✅ Restored: ${path.basename(rename.newPath)} → ${path.basename(rename.originalPath)}`);
      succeeded++;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.warn(`⚠️  Skipped: ${path.basename(rename.newPath)} not found`);
        skipped++;
      } else {
        throw error;
      }
    }
  }

  await appendHistory({
    id: new Date().toISOString(),
    timestamp: new Date().toISOString(),
    directory: entry.directory,
    dryRun: false,
    renames: reversed.map(r => ({ originalPath: r.newPath, newPath: r.originalPath }))
  });

  console.log(`\nUndo complete: ${succeeded} restored, ${skipped} skipped.`);
}
