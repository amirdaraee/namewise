import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import type { NamewiseError } from '../errors.js';

const LOG_DIR = path.join(os.homedir(), '.namewise', 'logs');
const MAX_LOG_FILES = 20;

interface LogEntry {
  ts: string;
  level: 'info' | 'warn' | 'error';
  msg: string;
  [key: string]: unknown;
}

export class Logger {
  readonly currentLogPath: string;
  readonly enabled: boolean;
  private initialized = false;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(command: string, enabled: boolean) {
    this.enabled = enabled;
    // ISO string with colons replaced for safe filenames: 2026-04-12T10-30-00
    const ts = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
    this.currentLogPath = path.join(LOG_DIR, `${ts}-${command}.log`);
  }

  private write(entry: LogEntry): void {
    if (!this.enabled) return;
    const line = JSON.stringify(entry) + '\n';
    this.writeQueue = this.writeQueue.then(async () => {
      try {
        if (!this.initialized) {
          await fs.mkdir(LOG_DIR, { recursive: true });
          await pruneOldLogs();
          this.initialized = true;
        }
        await fs.appendFile(this.currentLogPath, line, 'utf-8');
      } catch {
        // logger must never crash the host process
      }
    });
  }

  session(ctx: { command: string; directory: string; provider?: string; dryRun: boolean }): void {
    this.write({ ts: new Date().toISOString(), level: 'info', msg: 'session_start', ...ctx });
  }

  info(msg: string, ctx?: Record<string, unknown>): void {
    this.write({ ts: new Date().toISOString(), level: 'info', msg, ...ctx });
  }

  warn(msg: string, ctx?: Record<string, unknown>): void {
    this.write({ ts: new Date().toISOString(), level: 'warn', msg, ...ctx });
  }

  error(err: unknown, ctx?: Record<string, unknown>): void {
    const entry: LogEntry = { ts: new Date().toISOString(), level: 'error', msg: 'unknown_error' };
    if (err && typeof err === 'object' && 'name' in err && 'message' in err) {
      const e = err as NamewiseError;
      entry.msg = e.name ?? 'Error';
      entry.message = e.message;
      entry.stack = e.stack;
      if (e.hint !== undefined) entry.hint = e.hint;
      if (e.details !== undefined) entry.details = e.details;
    } else {
      entry.value = String(err);
    }
    if (ctx) Object.assign(entry, ctx);
    this.write(entry);
  }

  summary(ctx: {
    total: number;
    succeeded: number;
    failed: number;
    tokenUsage: { inputTokens?: number; outputTokens?: number };
    elapsedMs: number;
  }): void {
    this.write({
      ts: new Date().toISOString(),
      level: 'info',
      msg: 'session_end',
      total: ctx.total,
      succeeded: ctx.succeeded,
      failed: ctx.failed,
      inputTokens: ctx.tokenUsage.inputTokens,
      outputTokens: ctx.tokenUsage.outputTokens,
      elapsedMs: ctx.elapsedMs
    });
  }
}

async function pruneOldLogs(): Promise<void> {
  try {
    const files = await fs.readdir(LOG_DIR);
    const logFiles = files
      .filter(f => f.endsWith('.log'))
      .sort(); // ISO-prefixed names sort lexicographically by date
    if (logFiles.length >= MAX_LOG_FILES) {
      const deleteCount = logFiles.length - MAX_LOG_FILES + 1;
      const toDelete = logFiles.slice(0, deleteCount);
      await Promise.all(toDelete.map(f => fs.unlink(path.join(LOG_DIR, f)).catch(() => {})));
    }
  } catch {
    // LOG_DIR doesn't exist yet on first run — fs.mkdir above will create it
  }
}

// Module-level singleton. createLogger() replaces it at the start of each CLI command.
export let logger: Logger = new Logger('namewise', false);

export function createLogger(command: string, enabled = false): Logger {
  logger = new Logger(command, enabled);
  return logger;
}
