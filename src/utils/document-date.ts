const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parses a date the AI claims to have read off a document.
 *
 * Accepts only YYYY-MM-DD: the prompt asks for that format, and inferring
 * day/month order from an ambiguous string is exactly the silent wrongness this
 * feature exists to remove. Returns undefined for anything unparseable, not a
 * real calendar date, or outside 1900 -> today + 1 year (inclusive), so callers
 * cannot tell "invalid" from "absent" — both mean fall through to the next
 * source.
 *
 * The Date is built from LOCAL components because formatDate() reads local
 * getters; a UTC-constructed date renders a day early west of Greenwich.
 */
export function parseDocumentDate(raw: string | undefined): Date | undefined {
  if (!raw) return undefined;

  const match = ISO_DATE.exec(raw.trim());
  if (!match) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(year, month - 1, day);
  // JS rolls 2024-02-31 over into March; reject rather than accept the rollover
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return undefined;
  }

  const now = new Date();
  const lowerBound = new Date(1900, 0, 1);
  const upperBound = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  if (date < lowerBound || date > upperBound) return undefined;

  return date;
}
