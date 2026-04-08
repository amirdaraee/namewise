import { promises as fs } from 'fs';
import path from 'path';
import { collectFiles } from './fs-collect.js';

export type OrganizeBy = 'ext' | 'date' | 'size';

export interface OrganizeMapping {
  sourcePath: string;
  destPath: string;
  reason: string;
}

export async function computeOrganizeMappings(
  directory: string,
  by: OrganizeBy,
  recursive: boolean
): Promise<OrganizeMapping[]> {
  const files = await collectFiles(directory, { recursive });
  const mappings: OrganizeMapping[] = [];

  for (const filePath of files) {
    const stat = await fs.stat(filePath);
    const subDir = getSubDir(filePath, by, stat);
    const destDir = path.join(directory, subDir);
    const destPath = path.join(destDir, path.basename(filePath));

    // Skip if the file is already directly inside the correct subfolder
    if (path.dirname(filePath) === destDir) continue;

    mappings.push({ sourcePath: filePath, destPath, reason: subDir });
  }

  return mappings;
}

function getSubDir(
  filePath: string,
  by: OrganizeBy,
  stat: Awaited<ReturnType<typeof fs.stat>>
): string {
  switch (by) {
    case 'ext': {
      const ext = path.extname(filePath).toLowerCase().slice(1);
      return ext || 'other';
    }
    case 'date': {
      const d = stat.mtime;
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      return path.join(String(y), m);
    }
    case 'size': {
      const bytes = (stat as any).size ?? 0;
      if (bytes < 1024 * 1024) return 'small';
      if (bytes < 50 * 1024 * 1024) return 'medium';
      return 'large';
    }
  }
}
