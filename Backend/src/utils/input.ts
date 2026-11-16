/** Parse a query-string integer and force it into [min, max]; anything unparsable becomes the fallback. */
export const clampInt = (value: unknown, min: number, max: number, fallback: number): number => {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : typeof value === 'number' ? Math.trunc(value) : NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

/**
 * Free-text search terms end up inside PostgREST filter strings (`name.ilike.%term%,email.ilike.%term%`).
 * Commas, parentheses and wildcards would let a caller rewrite that filter, so only plain characters survive.
 */
export const safeSearchTerm = (value: unknown, maxLength = 80): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.replace(/[^\p{L}\p{N}\s@._-]/gu, '').trim().slice(0, maxLength);
  return cleaned || undefined;
};

/** Copy only the whitelisted keys (defends update endpoints against mass assignment). */
export const pick = <T extends Record<string, unknown>, K extends string>(source: T | undefined | null, keys: readonly K[]): Partial<Record<K, unknown>> => {
  const result: Partial<Record<K, unknown>> = {};
  if (!source || typeof source !== 'object') return result;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) result[key] = source[key];
  }
  return result;
};
