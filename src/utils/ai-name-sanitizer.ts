import { applyNamingConvention, stripWindowsIllegalChars, NamingConvention } from './naming-conventions.js';
import { ParseError } from '../errors.js';

const MAX_NAME_WORDS = 12;
const PROSE_PREFIX = /^(based on|i can|i cannot|i am|i'm|this is|this appears|the document|the image|unable to|sorry|it appears|here is|here's)\b/i;

/**
 * Reject AI output that is an explanation rather than a filename ("Based on
 * the document content, I can only identify…"). Truncating prose to 100 chars
 * produces garbage names — failing the file is the honest outcome.
 */
function assertLooksLikeFileName(raw: string): void {
  const asWords = raw.replace(/[-_]+/g, ' ').trim();
  const wordCount = asWords.split(/\s+/).filter(Boolean).length;
  if (wordCount > MAX_NAME_WORDS || PROSE_PREFIX.test(asWords)) {
    throw new ParseError(`AI returned an explanation instead of a filename: "${raw.slice(0, 80)}…"`);
  }
}

/**
 * Sanitizes AI-suggested filenames from cloud providers (Claude, OpenAI):
 * strips the extension and Windows-illegal characters, applies the naming
 * convention, and truncates overly long names at a word boundary.
 */
export function sanitizeCloudFileName(name: string, convention: NamingConvention): string {
  const nameWithoutExt = name.replace(/\.[^/.]+$/, '');
  assertLooksLikeFileName(nameWithoutExt);
  const safeForWindows = stripWindowsIllegalChars(nameWithoutExt);
  let cleaned = applyNamingConvention(safeForWindows, convention);

  if (!cleaned) {
    cleaned = applyNamingConvention('untitled document', convention);
  } else if (cleaned.length > 100) {
    cleaned = cleaned.substring(0, 100);
    if (convention === 'kebab-case') {
      cleaned = cleaned.replace(/-[^-]*$/, '');
    } else if (convention === 'snake_case') {
      cleaned = cleaned.replace(/_[^_]*$/, '');
    }
  }

  return cleaned;
}

/**
 * Sanitizes AI-suggested filenames from local providers (Ollama, LMStudio):
 * strips surrounding quotes and known extensions, replaces invalid characters
 * and whitespace with hyphens, and lowercases the result.
 */
export function sanitizeLocalFileName(filename: string): string {
  const unquoted = filename.trim().replace(/^["']|["']$/g, '');
  assertLooksLikeFileName(unquoted);
  return unquoted
    .replace(/\.(txt|pdf|docx?|xlsx?|md|rtf)$/i, '') // Remove extensions
    .replace(/[<>:"/\\|?*]/g, '-') // Replace invalid characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .toLowerCase();
}
