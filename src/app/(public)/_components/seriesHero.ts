// Feature 049 (P7-R5): per-series → committed static hero asset under public/series/ (D-4: curated,
// committed, low-churn — no upload substrate). Keyed by the stable series key (see B48 re: a shared source
// of truth for series keys). Filenames are as supplied — note tnc's image is named `contra`. Any unmapped
// or future series → null, so the event page renders a clean series-colored header (no broken image).
// `public/series/meeting.jpg` is reserved for future meeting events; no dance series maps to it today.

const SERIES_HERO: Record<string, string> = {
  tnc: "/series/contra.webp",
  ecd: "/series/ecd.jpg",
  community_dance: "/series/community_dance.jpg",
  general: "/series/general.jpg",
};

/** The committed hero image path for a series, or null when the series has no curated image. */
export function seriesHeroSrc(seriesKey: string): string | null {
  return SERIES_HERO[seriesKey] ?? null;
}
