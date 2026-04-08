import { promises as fs } from 'fs';
import path from 'path';
import { collectFiles } from '../utils/fs-collect.js';
import { hashFile } from '../utils/dedup.js';

export interface DiffOptions {
  by?: 'name' | 'hash';
  recursive?: boolean;
}

export async function diffDirectories(
  dir1: string,
  dir2: string,
  options: DiffOptions
): Promise<void> {
  const s1 = await fs.stat(dir1);
  if (!s1.isDirectory()) throw new Error(`${dir1} is not a directory`);
  const s2 = await fs.stat(dir2);
  if (!s2.isDirectory()) throw new Error(`${dir2} is not a directory`);

  const recursive = options.recursive ?? true;
  const byHash = options.by === 'hash';

  const files1 = await collectFiles(dir1, { recursive });
  const files2 = await collectFiles(dir2, { recursive });

  const names1 = new Set(files1.map(f => path.relative(dir1, f)));
  const names2 = new Set(files2.map(f => path.relative(dir2, f)));

  const onlyIn1 = [...names1].filter(n => !names2.has(n));
  const onlyIn2 = [...names2].filter(n => !names1.has(n));

  if (byHash && (onlyIn1.length > 0 || onlyIn2.length > 0)) {
    await diffByHash(dir1, dir2, onlyIn1, onlyIn2);
  } else {
    printDiff(dir1, dir2, onlyIn1, onlyIn2, []);
  }
}

async function diffByHash(
  dir1: string,
  dir2: string,
  onlyIn1: string[],
  onlyIn2: string[]
): Promise<void> {
  const hashes1 = new Map<string, string>(); // hash → rel path in dir1
  const hashes2 = new Map<string, string>(); // hash → rel path in dir2

  for (const rel of onlyIn1) {
    const h = await hashFile(path.join(dir1, rel));
    hashes1.set(h, rel);
  }
  for (const rel of onlyIn2) {
    const h = await hashFile(path.join(dir2, rel));
    hashes2.set(h, rel);
  }

  const moved: Array<{ from: string; to: string }> = [];
  const stillOnlyIn1: string[] = [];
  const stillOnlyIn2 = new Set(hashes2.keys());

  for (const [hash, rel1] of hashes1) {
    if (hashes2.has(hash)) {
      moved.push({ from: rel1, to: hashes2.get(hash)! });
      stillOnlyIn2.delete(hash);
    } else {
      stillOnlyIn1.push(rel1);
    }
  }

  printDiff(dir1, dir2, stillOnlyIn1, [...stillOnlyIn2].map(h => hashes2.get(h)!), moved);
}

function printDiff(
  dir1: string,
  dir2: string,
  onlyIn1: string[],
  onlyIn2: string[],
  moved: Array<{ from: string; to: string }>
): void {
  if (onlyIn1.length === 0 && onlyIn2.length === 0 && moved.length === 0) {
    console.log('Directories are identical.');
    return;
  }

  if (onlyIn1.length > 0) {
    console.log(`\nOnly in ${dir1}:`);
    for (const f of onlyIn1) console.log(`  - ${f}`);
  }
  if (onlyIn2.length > 0) {
    console.log(`\nOnly in ${dir2}:`);
    for (const f of onlyIn2) console.log(`  + ${f}`);
  }
  if (moved.length > 0) {
    console.log('\nMoved/renamed (same content):');
    for (const { from, to } of moved) console.log(`  ${from} → ${to}`);
  }

  const total = onlyIn1.length + onlyIn2.length + moved.length;
  console.log(`\n${total} difference(s) found.`);
}
