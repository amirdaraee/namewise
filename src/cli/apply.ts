import { promises as fs } from 'fs';
import path from 'path';
import { appendHistory } from '../utils/history.js';
import * as ui from '../utils/ui.js';

interface PlanResult {
  originalPath: string;
  newPath: string;
  success: boolean;
}

interface PlanFile {
  results: PlanResult[];
}

export async function applyPlan(planPath: string, options: { dryRun?: boolean } = {}): Promise<void> {
  let plan: PlanFile;
  try {
    const raw = await fs.readFile(planPath, 'utf-8');
    plan = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Could not read plan file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  if (!Array.isArray(plan.results)) {
    throw new Error('Invalid plan file: missing "results" array');
  }

  const pending = plan.results.filter(r => r.success && r.originalPath !== r.newPath);

  if (pending.length === 0) {
    ui.info('No renames to apply.');
    return;
  }

  for (const r of pending) {
    try {
      await fs.access(r.originalPath);
    } catch {
      throw new Error(`Source file not found: ${r.originalPath}`);
    }
  }

  for (const r of pending) {
    let targetExists = false;
    try {
      await fs.access(r.newPath);
      targetExists = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (targetExists) throw new Error(`Target already exists: ${r.newPath}`);
  }

  const renames: Array<{ originalPath: string; newPath: string }> = [];
  let previewCount = 0;

  for (const r of pending) {
    if (options.dryRun) {
      ui.dim(`[dry-run] ${path.basename(r.originalPath)} → ${path.basename(r.newPath)}`);
    } else {
      ui.success(`${path.basename(r.originalPath)} → ${path.basename(r.newPath)}`);
    }
    if (!options.dryRun) {
      await fs.rename(r.originalPath, r.newPath);
      renames.push({ originalPath: r.originalPath, newPath: r.newPath });
    } else {
      previewCount++;
    }
  }

  if (!options.dryRun && renames.length > 0) {
    await appendHistory({
      id: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      directory: path.dirname(renames[0].originalPath),
      dryRun: false,
      renames
    });
  }

  const count = options.dryRun ? previewCount : renames.length;
  ui.info(`\n${options.dryRun ? 'Would apply' : 'Applied'}: ${count} rename(s).`);
}
