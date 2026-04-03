import { createHash } from 'crypto';
import { createReadStream, promises as fs } from 'fs';
import path from 'path';

export async function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk: Buffer | string) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

export async function findDuplicates(
  directory: string,
  recursive: boolean = false
): Promise<Map<string, string[]>> {
  const files = await collectAllFiles(directory, recursive);
  const hashMap = new Map<string, string[]>();

  for (const filePath of files) {
    const hash = await hashFile(filePath);
    const group = hashMap.get(hash) ?? [];
    group.push(filePath);
    hashMap.set(hash, group);
  }

  const duplicates = new Map<string, string[]>();
  for (const [hash, paths] of hashMap) {
    if (paths.length > 1) duplicates.set(hash, paths);
  }
  return duplicates;
}

async function collectAllFiles(dir: string, recursive: boolean): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory() && recursive) {
      files.push(...await collectAllFiles(entryPath, recursive));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}
