import { promises as fs } from 'fs';
import path from 'path';
import { collectFiles } from './fs-collect.js';

export interface TypeStats {
  ext: string;
  count: number;
  bytes: number;
}

export interface DirStats {
  totalFiles: number;
  totalBytes: number;
  byType: TypeStats[];
  largest: Array<{ path: string; bytes: number }>;
}

export async function computeStats(
  directory: string,
  recursive: boolean = false
): Promise<DirStats> {
  const filePaths = await collectFiles(directory, { recursive });
  const typeMap = new Map<string, { count: number; bytes: number }>();
  const allFiles: Array<{ path: string; bytes: number }> = [];

  for (const filePath of filePaths) {
    const stat = await fs.stat(filePath);
    const ext = path.extname(filePath).toLowerCase() || '(no ext)';
    const entry = typeMap.get(ext) ?? { count: 0, bytes: 0 };
    typeMap.set(ext, { count: entry.count + 1, bytes: entry.bytes + stat.size });
    allFiles.push({ path: filePath, bytes: stat.size });
  }

  allFiles.sort((a, b) => b.bytes - a.bytes);

  const byType: TypeStats[] = [...typeMap.entries()]
    .map(([ext, { count, bytes }]) => ({ ext, count, bytes }))
    .sort((a, b) => b.bytes - a.bytes);

  return {
    totalFiles: filePaths.length,
    totalBytes: byType.reduce((sum, t) => sum + t.bytes, 0),
    byType,
    largest: allFiles.slice(0, 10)
  };
}
