import { promises as fs, createReadStream } from 'fs';
import { createHash } from 'crypto';
import path from 'path';
import { formatBytes } from '../utils/fs-collect.js';
import * as ui from '../utils/ui.js';

export async function infoCommand(targetPath: string): Promise<void> {
  const stat = await fs.stat(targetPath);
  if (stat.isDirectory()) {
    await showDirInfo(targetPath);
  } else {
    await showFileInfo(targetPath, stat);
  }
}

async function showFileInfo(
  filePath: string,
  stat: Awaited<ReturnType<typeof fs.stat>>
): Promise<void> {
  const hash = await hashFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  ui.info(`\nFile: ${path.resolve(filePath)}`);
  console.log(`  Size:     ${formatBytes(Number(stat.size))} (${stat.size} bytes)`);
  console.log(`  Created:  ${stat.birthtime.toISOString().replace('T', ' ').slice(0, 19)}`);
  console.log(`  Modified: ${stat.mtime.toISOString().replace('T', ' ').slice(0, 19)}`);
  console.log(`  Accessed: ${stat.atime.toISOString().replace('T', ' ').slice(0, 19)}`);
  console.log(`  Ext:      ${ext || '(none)'}`);
  console.log(`  SHA-256:  ${hash}`);
}

async function showDirInfo(dirPath: string): Promise<void> {
  let fileCount = 0;
  let dirCount = 0;
  let totalBytes = 0;
  await walkDir(dirPath, (isDir, size) => {
    if (isDir) dirCount++;
    else { fileCount++; totalBytes += size; }
  });
  ui.info(`\nDirectory: ${path.resolve(dirPath)}`);
  console.log(`  Files:       ${fileCount}`);
  console.log(`  Directories: ${dirCount}`);
  console.log(`  Total size:  ${formatBytes(totalBytes)}`);
}

async function walkDir(
  dir: string,
  cb: (isDir: boolean, size: number) => void
): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      cb(true, 0);
      await walkDir(p, cb);
    } else {
      const stat = await fs.stat(p);
      cb(false, stat.size);
    }
  }
}

function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk: Buffer | string) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}
