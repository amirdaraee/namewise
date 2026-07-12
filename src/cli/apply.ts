import { promises as fs } from 'fs';
import path from 'path';
import { NamewiseError } from '../errors.js';
import { appendHistory } from '../utils/history.js';
import * as ui from '../utils/ui.js';

interface PlanResult {
  originalPath: string;
  newPath: string;
  success: boolean;
}

interface PlanFile {
  directory?: string;
  results: PlanResult[];
}

export async function applyPlan(planPath: string, options: { dryRun?: boolean } = {}): Promise<void> {
  let plan: PlanFile;
  try {
    const raw = await fs.readFile(planPath, 'utf-8');
    plan = JSON.parse(raw);
  } catch (error) {
    throw new NamewiseError(`Could not read plan file: ${error instanceof Error ? error.message : 'Unknown error'}`, {
      cause: error,
      hint: 'Generate a plan with: namewise rename <dir> --dry-run --output plan.json'
    });
  }

  if (!Array.isArray(plan.results)) {
    throw new NamewiseError('Invalid plan file: missing "results" array', {
      hint: 'Generate a plan with: namewise rename <dir> --dry-run --output plan.json'
    });
  }

  // Plans written by older versions stored paths relative to the scanned
  // directory; anchor them there instead of whatever cwd apply runs from.
  const anchor = (f: string) =>
    path.isAbsolute(f) || !plan.directory ? f : path.join(plan.directory, f);

  const pending = plan.results
    .filter(r => r.success && r.originalPath !== r.newPath)
    .map(r => ({ ...r, originalPath: anchor(r.originalPath), newPath: anchor(r.newPath) }));

  if (pending.length === 0) {
    ui.info('No renames to apply.');
    return;
  }

  for (const r of pending) {
    try {
      await fs.access(r.originalPath);
    } catch {
      throw new NamewiseError(`Source file not found: ${r.originalPath}`, {
        hint: 'The file moved or was renamed since the plan was created — regenerate the plan or remove the entry'
      });
    }
  }

  // Two plan entries pointing at one target would silently overwrite each
  // other when applied — fs.rename replaces existing files without error.
  const seenTargets = new Set<string>();
  for (const r of pending) {
    if (seenTargets.has(r.newPath)) {
      throw new NamewiseError(`Duplicate target in plan: ${r.newPath} (two files would overwrite each other)`, {
        hint: 'Edit the plan so every newPath is unique, then re-run apply'
      });
    }
    seenTargets.add(r.newPath);
  }

  for (const r of pending) {
    let targetExists = false;
    try {
      await fs.access(r.newPath);
      targetExists = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (targetExists) {
      throw new NamewiseError(`Target already exists: ${r.newPath}`, {
        hint: 'A file already occupies this name — regenerate the plan or remove the entry'
      });
    }
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
