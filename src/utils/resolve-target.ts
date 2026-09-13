import { promises as fs } from 'fs';
import path from 'path';

const MAX_ATTEMPTS = 99;

async function sameFile(a: string, b: string): Promise<boolean> {
  try {
    const [statA, statB] = await Promise.all([fs.stat(a), fs.stat(b)]);
    return statA.dev === statB.dev && statA.ino === statB.ino;
  } catch {
    return false;
  }
}

/**
 * True when `candidate` is occupied by something other than `sourcePath`.
 *
 * macOS and Windows filesystems are case-insensitive, so a case-only rename
 * (Документ.txt → документ.txt) makes fs.access resolve to the source file
 * itself. Comparing device and inode tells that apart from a real collision.
 */
async function isTaken(candidate: string, sourcePath?: string): Promise<boolean> {
  try {
    await fs.access(candidate);
  } catch {
    return false;
  }
  if (sourcePath && (await sameFile(candidate, sourcePath))) return false;
  return true;
}

/**
 * Returns a target path nothing else in this batch has taken.
 *
 * The mechanical rename paths (--pattern, --truncate, --strip, --sequence,
 * --prefix, --suffix, --date-stamp) can map several files onto one name —
 * truncating `report-january` and `report-february` to 7 characters yields
 * `report-` for both. Renaming straight onto the same target destroys the
 * earlier file, so claim each target and fall back to `name-2`, `name-3`, …
 * the way FileRenamer already does for AI-suggested names.
 *
 * `claimed` is mutated: the returned path is added to it. Callers share one
 * set across a batch, including dry runs, so a preview matches the real run.
 *
 * Pass `sourcePath` so a case-only rename on a case-insensitive filesystem is
 * not mistaken for a collision with itself.
 */
export async function resolveTargetPath(
  desiredPath: string,
  claimed: Set<string>,
  sourcePath?: string
): Promise<string> {
  const ext = path.extname(desiredPath);
  const dir = path.dirname(desiredPath);
  const base = path.basename(desiredPath, ext);

  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    const candidate = i === 1 ? desiredPath : path.join(dir, `${base}-${i}${ext}`);
    if (claimed.has(candidate)) continue;
    if (await isTaken(candidate, sourcePath)) continue;
    claimed.add(candidate);
    return candidate;
  }

  throw new Error(
    `Could not find an available filename for: ${path.basename(desiredPath)} (tried -2 through -${MAX_ATTEMPTS})`
  );
}
