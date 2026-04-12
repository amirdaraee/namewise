import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import path from 'path';
import type { FileInfo, RenameResult } from '../types/index.js';

// ── Stderr suppression ───────────────────────────────────────────────────────
// Used to silence library noise (pdfjs "TT: undefined function" warnings).

let _originalStderr: typeof process.stderr.write | null = null;

export function suppressStderr(): void {
  if (_originalStderr) return;
  _originalStderr = process.stderr.write.bind(process.stderr);
  (process.stderr as any).write = () => true;
}

export function restoreStderr(): void {
  if (!_originalStderr) return;
  (process.stderr as any).write = _originalStderr;
  _originalStderr = null;
}

// ── Core output ──────────────────────────────────────────────────────────────

/** Plain message — no decoration. Keeps toHaveBeenCalledWith(msg) tests green. */
export function info(msg: string): void {
  console.log(msg);
}

/** Dim/muted text — for secondary information. */
export function dim(msg: string): void {
  console.log(chalk.dim(msg));
}

/** ✓ green success line */
export function success(msg: string): void {
  console.log(chalk.green('✓') + '  ' + msg);
}

/** ! yellow warning line */
export function warn(msg: string): void {
  console.warn(chalk.yellow('!') + '  ' + msg);
}

/** ✗ red error line */
export function error(msg: string): void {
  console.error(chalk.red('✗') + '  ' + msg);
}

/** → dim indented suggestion — shown below an error or warning line */
export function hint(msg: string): void {
  console.log(chalk.dim('   → ') + chalk.dim(msg));
}

// ── Structural ───────────────────────────────────────────────────────────────

/** Print a labelled section header with a horizontal rule below it. */
export function section(title: string): void {
  const rule = chalk.dim('─'.repeat(56));
  console.log('\n' + chalk.bold(title));
  console.log(rule);
}

/** Print a short horizontal rule with no label. */
export function rule(): void {
  console.log(chalk.dim('─'.repeat(56)));
}

// ── Spinner factory ──────────────────────────────────────────────────────────

export function spinner(text: string): Ora {
  return ora({ text, color: 'cyan' });
}

// ── Rename result rows ───────────────────────────────────────────────────────

// ✓  <original>  →  <new-name>   — all on one line, 80-col budget:
//   prefix(3) + orig(30) + sep(5) + new(40) = 78
const MAX_ORIG = 30;
const MAX_NEW  = 40;

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/** Print one file's rename result as a single-line entry. */
export function fileRow(result: RenameResult): void {
  const original = path.basename(result.originalPath);
  const newName  = path.basename(result.newPath);

  if (!result.success) {
    console.log(chalk.red('✗') + '  ' + chalk.dim(truncate(original, MAX_ORIG)));
    if (result.error) {
      console.log('   ' + chalk.dim('! ') + chalk.yellow(result.error));
    }
    return;
  }

  const origFmt = chalk.dim(truncate(original, MAX_ORIG));
  if (newName === original) {
    console.log(chalk.green('✓') + '  ' + origFmt);
    return;
  }

  // Renamed — show original → new on one line
  console.log(chalk.green('✓') + '  ' + origFmt + '  ' + chalk.dim('→') + '  ' + truncate(newName, MAX_NEW));
}

// ── Stats block ──────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  if (bytes >= 1024)         return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

export function renameStats(opts: {
  elapsed: number;
  files: FileInfo[];
  successCount: number;
  failCount: number;
  tokenUsage: { inputTokens?: number; outputTokens?: number };
  dryRun: boolean;
}): void {
  const { elapsed, files, successCount, failCount, tokenUsage, dryRun } = opts;

  const elapsedStr = elapsed < 1000
    ? elapsed + 'ms'
    : (elapsed / 1000).toFixed(1) + 's';

  const totalBytes = files.reduce((s, f) => s + f.size, 0);
  const extCounts: Record<string, number> = {};
  for (const f of files) {
    const ext = f.extension.slice(1).toUpperCase();
    extCounts[ext] = (extCounts[ext] ?? 0) + 1;
  }
  const extSummary = Object.entries(extCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ext, n]) => chalk.dim(n + ' ' + ext))
    .join('  ');

  rule();

  // Pad to 12 chars so "Renamed" and "Would rename" align columns identically
  const verb = (dryRun ? 'Would rename' : 'Renamed').padEnd(12);
  const renamedStr = chalk.green(String(successCount));
  const failedStr  = failCount > 0 ? chalk.red(String(failCount)) : chalk.dim('0');
  console.log(`${verb}  ${renamedStr}    ${chalk.dim('Failed')}  ${failedStr}`);
  console.log(`${chalk.dim('Data')}     ${formatBytes(totalBytes)}  ·  ${extSummary}`);

  if (tokenUsage.inputTokens !== undefined && tokenUsage.outputTokens !== undefined) {
    const inStr  = tokenUsage.inputTokens.toLocaleString();
    const outStr = tokenUsage.outputTokens.toLocaleString();
    console.log(`${chalk.dim('Tokens')}   ${inStr} in  ·  ${outStr} out    ${chalk.dim(elapsedStr)}`);
  } else {
    console.log(`${chalk.dim('Time')}     ${elapsedStr}    ${chalk.dim('Tokens  N/A (local provider)')}`);
  }
}
