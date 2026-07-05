import { applyNamingConvention, stripWindowsIllegalChars, NamingConvention } from './naming-conventions.js';

/**
 * Sanitizes AI-suggested filenames from cloud providers (Claude, OpenAI):
 * strips the extension and Windows-illegal characters, applies the naming
 * convention, and truncates overly long names at a word boundary.
 */
export function sanitizeCloudFileName(name: string, convention: NamingConvention): string {
  const nameWithoutExt = name.replace(/\.[^/.]+$/, '');
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
  return filename
    .trim()
    .replace(/^["']|["']$/g, '') // Remove quotes
    .replace(/\.(txt|pdf|docx?|xlsx?|md|rtf)$/i, '') // Remove extensions
    .replace(/[<>:"/\\|?*]/g, '-') // Replace invalid characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .toLowerCase();
}
