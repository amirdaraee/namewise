import { promises as fs } from 'fs';
import path from 'path';
import { FileInfo } from '../types/index.js';

/**
 * Stat a file and build the FileInfo record consumed by the rename pipeline.
 * Shared by the `rename` scanner and the `watch` add-handler, which previously
 * each built this literal by hand.
 */
export async function statToFileInfo(filePath: string): Promise<FileInfo> {
  const stats = await fs.stat(filePath);
  const fullPath = path.resolve(filePath);
  const folderPath = path.dirname(fullPath).split(path.sep).filter(p => p);

  return {
    path: filePath,
    name: path.basename(filePath),
    extension: path.extname(filePath).toLowerCase(),
    size: stats.size,
    createdAt: stats.birthtime,
    modifiedAt: stats.mtime,
    accessedAt: stats.atime,
    parentFolder: path.basename(path.dirname(filePath)),
    folderPath: folderPath.slice(-3),
    documentMetadata: undefined
  };
}
