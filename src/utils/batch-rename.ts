import type { DateFormat } from '../types/index.js';

export function applySequence(
  index: number,
  total: number,
  prefix?: string
): string {
  const pad = Math.max(String(total).length, 3);
  const num = String(index + 1).padStart(pad, '0');
  return prefix ? `${prefix}-${num}` : num;
}

export function applyPrefix(stem: string, prefix: string): string {
  return `${prefix}${stem}`;
}

export function applySuffix(stem: string, suffix: string): string {
  return `${stem}${suffix}`;
}

export function applyDateStamp(stem: string, date: Date, format: DateFormat): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  let stamp: string;
  switch (format) {
    case 'YYYY': stamp = `${y}`; break;
    case 'YYYYMMDD': stamp = `${y}${m}${d}`; break;
    default: stamp = `${y}-${m}-${d}`; break; // 'YYYY-MM-DD' and 'none'
  }
  return `${stamp}-${stem}`;
}

export function applyStrip(stem: string, pattern: string): string {
  return stem.replace(new RegExp(pattern, 'g'), '');
}

export function applyTruncate(stem: string, maxLen: number): string {
  return stem.slice(0, maxLen);
}
