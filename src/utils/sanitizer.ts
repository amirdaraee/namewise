import { applyNamingConvention, stripWindowsIllegalChars } from './naming-conventions.js';
import { NamingConvention } from '../types/index.js';

export function sanitizeFilename(stem: string, convention: NamingConvention = 'kebab-case'): string {
  let result = stem.normalize('NFC');
  result = stripWindowsIllegalChars(result);
  // eslint-disable-next-line no-control-regex -- stripping control chars from filenames is the point
  result = result.replace(/[\x00-\x1F\x7F]/g, '');
  result = applyNamingConvention(result, convention);
  if (result.length > 200) result = result.slice(0, 200);
  return result;
}
