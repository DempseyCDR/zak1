/** Normalize a display name for fuzzy search (lower + collapse whitespace). */
export function normalizeName(displayName: string): string {
  return displayName.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Derive the maintained name values from structured input (feature 012):
 * - displayName: the override when non-blank, else trimmed "first last" (just first when last is blank).
 * - nameNormalized: search key = normalize(effective display name).
 * - dedupNormalized: dedup key = normalize("first last") — ignores the override so a nickname cannot
 *   mask a duplicate; the first name alone when last is blank.
 */
export function deriveContactNames(input: {
  firstName: string;
  lastName?: string | null;
  displayNameOverride?: string | null;
}): { displayName: string; nameNormalized: string; dedupNormalized: string } {
  const structured = `${input.firstName} ${input.lastName ?? ""}`.trim();
  const override = input.displayNameOverride?.trim();
  const displayName = override && override.length > 0 ? override : structured;
  return {
    displayName,
    nameNormalized: normalizeName(displayName),
    dedupNormalized: normalizeName(structured),
  };
}

/** De-duplicate a set of enum-ish values, preserving first-seen order. */
export function uniqueSet<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
