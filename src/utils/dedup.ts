import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { collectFiles } from './fs-collect.js';

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
  const files = await collectFiles(directory, { recursive });
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

