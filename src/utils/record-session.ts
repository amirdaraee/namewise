import path from 'path';
import { appendHistory } from './history.js';

/**
 * Record a rename session in ~/.namewise/history.json.
 *
 * Wraps the `appendHistory` entry literal (id/timestamp/directory/dryRun/renames)
 * that was previously hand-built at every call site. The directory is resolved
 * to an absolute path (idempotent for already-absolute paths).
 *
 * Lives in its own module (rather than history.ts) so that tests which mock
 * history.js and assert on `appendHistory` keep working unchanged.
 */
export async function recordSession(
  directory: string,
  dryRun: boolean,
  renames: Array<{ originalPath: string; newPath: string }>,
  tokenUsage?: { inputTokens?: number; outputTokens?: number }
): Promise<void> {
  const timestamp = new Date().toISOString();
  await appendHistory({
    id: timestamp,
    timestamp,
    directory: path.resolve(directory),
    dryRun,
    renames,
    tokenUsage
  });
}
