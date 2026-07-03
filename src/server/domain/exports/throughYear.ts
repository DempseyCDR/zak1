/** Calendar year of a membership expiry date (FR-007); null when there is no expiry. */
export function throughYear(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  return Number(expiryDate.slice(0, 4));
}
