import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

export interface HistoryEntry {
  id: string;
  timestamp: string;
  directory: string;
  dryRun: boolean;
  renames: Array<{ originalPath: string; newPath: string }>;
}

const HISTORY_DIR = path.join(os.homedir(), '.namewise');
const HISTORY_FILE = path.join(HISTORY_DIR, 'history.json');

export async function readHistory(): Promise<HistoryEntry[]> {
  try {
    const raw = await fs.readFile(HISTORY_FILE, 'utf-8');
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

export async function appendHistory(entry: HistoryEntry): Promise<void> {
  await fs.mkdir(HISTORY_DIR, { recursive: true });
  const history = await readHistory();
  history.push(entry);
  await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
}
