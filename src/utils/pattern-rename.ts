export function parsePattern(pattern: string): { find: RegExp; replace: string } {
  const sedMatch = pattern.match(/^s\/((?:[^/\\]|\\.)*)\/((?:[^/\\]|\\.)*)\/([gimu]*)$/);
  if (sedMatch) {
    const [, find, replace, flags] = sedMatch;
    try {
      // User-supplied regex is the point of the s/find/replace/ syntax; it only
      // runs against the user's own filenames in their own process.
      return { find: new RegExp(find, flags || undefined), replace };
    } catch {
      throw new Error(`Invalid regular expression in pattern: "${find}"`);
    }
  }

  const colonIdx = pattern.indexOf(':');
  if (colonIdx > 0) {
    const find = pattern.slice(0, colonIdx);
    const replace = pattern.slice(colonIdx + 1);
    return { find: new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), replace };
  }

  throw new Error(`Invalid pattern format: "${pattern}". Use s/find/replace/flags or find:replace`);
}

export function applyPatterns(stem: string, patterns: string[]): string {
  let result = stem;
  for (const pattern of patterns) {
    const { find, replace } = parsePattern(pattern);
    result = result.replace(find, replace);
  }
  return result;
}
