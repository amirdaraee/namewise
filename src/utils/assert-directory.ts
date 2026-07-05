import { promises as fs } from 'fs';

/**
 * Validate that a path exists and is a directory.
 *
 * Throws the stat error (e.g. ENOENT) when the path does not exist, or
 * `"<path> is not a directory"` when it exists but is not a directory —
 * the exact error text shared by every subcommand.
 */
export async function assertDirectory(dirPath: string): Promise<void> {
  const stat = await fs.stat(dirPath);
  if (!stat.isDirectory()) {
    throw new Error(`${dirPath} is not a directory`);
  }
}
