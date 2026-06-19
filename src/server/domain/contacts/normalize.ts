/** Normalize a display name for fuzzy search (lower + collapse whitespace). */
export function normalizeName(displayName: string): string {
  return displayName.trim().toLowerCase().replace(/\s+/g, " ");
}

/** De-duplicate a set of enum-ish values, preserving first-seen order. */
export function uniqueSet<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
