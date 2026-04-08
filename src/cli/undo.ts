import { promises as fs } from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import { readHistory, appendHistory, HistoryEntry } from '../utils/history.js';

export async function undoRename(
  sessionId?: string,
  options: { list?: boolean; all?: boolean } = {}
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

  if (options.all) {
    await undoAll();
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

  await undoSession(entry);
}

async function undoSession(entry: HistoryEntry): Promise<{ succeeded: number; skipped: number }> {
  const reversed = [...entry.renames].reverse();
  let succeeded = 0;
  let skipped = 0;

  for (const rename of reversed) {
    try {
      await fs.access(rename.newPath);
      await fs.rename(rename.newPath, rename.originalPath);
      console.log(`Restored: ${path.basename(rename.newPath)} → ${path.basename(rename.originalPath)}`);
      succeeded++;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.warn(`Skipped: ${path.basename(rename.newPath)} not found`);
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
  return { succeeded, skipped };
}

async function undoAll(): Promise<void> {
  const history = await readHistory();
  const sessions = [...history].reverse().filter(e => !e.dryRun);

  if (sessions.length === 0) {
    console.log('No undo-able rename sessions found.');
    return;
  }

  if (sessions.length > 1) {
    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: `Undo all ${sessions.length} rename session(s)?`,
      default: false
    }]);
    if (!confirm) {
      console.log('Cancelled.');
      return;
    }
  }

  for (const session of sessions) {
    console.log(`\nUndoing session: ${session.id}`);
    try {
      await undoSession(session);
    } catch (error) {
      console.error(`Error: Failed to undo session ${session.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
