import { promises as fs } from 'fs';
import path from 'path';
import { collectFiles, formatBytes } from '../utils/fs-collect.js';
import * as ui from '../utils/ui.js';

export interface FindOptions {
  ext?: string;
  name?: string;
  largerThan?: string;
  smallerThan?: string;
  newerThan?: string;
  olderThan?: string;
  recursive?: boolean;
}

export async function findFiles(
  directory: string,
  options: FindOptions
): Promise<void> {
  const stat = await fs.stat(directory);
  if (!stat.isDirectory()) throw new Error(`${directory} is not a directory`);

  const files = await collectFiles(directory, { recursive: options.recursive ?? true });
  const matches: Array<{ filePath: string; size: number; mtime: Date }> = [];

  const largerBytes = options.largerThan ? parseSize(options.largerThan) : null;
  const smallerBytes = options.smallerThan ? parseSize(options.smallerThan) : null;
  const newerDate = options.newerThan ? new Date(options.newerThan) : null;
  const olderDate = options.olderThan ? new Date(options.olderThan) : null;
  const nameRegex = options.name ? globToRegex(options.name) : null;
  const extFilter = options.ext
    ? options.ext.toLowerCase().replace(/^\./, '')
    : null;

  for (const filePath of files) {
    const fileStat = await fs.stat(filePath);
    const ext = path.extname(filePath).toLowerCase().slice(1);

    if (extFilter !== null && ext !== extFilter) continue;
    if (nameRegex && !nameRegex.test(path.basename(filePath))) continue;
    if (largerBytes !== null && fileStat.size <= largerBytes) continue;
    if (smallerBytes !== null && fileStat.size >= smallerBytes) continue;
    if (newerDate && fileStat.mtime <= newerDate) continue;
    if (olderDate && fileStat.mtime >= olderDate) continue;

    matches.push({ filePath, size: fileStat.size, mtime: fileStat.mtime });
  }

  if (matches.length === 0) {
    ui.info('No files matched.');
    return;
  }

  for (const m of matches) {
    const rel = path.relative(directory, m.filePath);
    const dateStr = m.mtime.toISOString().slice(0, 10);
    console.log(`${rel.padEnd(50)} ${formatBytes(m.size).padStart(10)}  ${dateStr}`);
  }
  ui.info(`\n${matches.length} file(s) matched.`);
}

function parseSize(s: string): number {
  const lower = s.toLowerCase();
  if (lower.endsWith('gb')) return parseFloat(lower) * 1024 * 1024 * 1024;
  if (lower.endsWith('mb')) return parseFloat(lower) * 1024 * 1024;
  if (lower.endsWith('kb')) return parseFloat(lower) * 1024;
  return parseInt(lower, 10);
}

function globToRegex(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}
