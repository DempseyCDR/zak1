import { EVENT_TYPE_COLORS, type EventType } from "@/app/tokens";

// Feature 048 (P7-R4): the single source mapping a series (by its stable key) to a P7-R1 event-type color.
// The event card colors its accent from this map — never from the display `activity` string (brittle) and
// never from a DB color column (the palette is a fixed brand constant, per research R2). Any unmapped or
// future series falls back to the neutral `--band` accent, so a new series is never unstyled or broken.
// `meeting` (var(--type-meeting)) is reserved for future meeting events — no dance series maps to it.

const SERIES_COLOR: Record<string, EventType> = {
  tnc: "contra",
  ecd: "english",
  community_dance: "special",
  general: "assembly",
};

/** The CSS color value for a series' card accent: its mapped R1 type color, or the neutral default. */
export function seriesColorVar(seriesKey: string): string {
  const type = SERIES_COLOR[seriesKey];
  return type ? EVENT_TYPE_COLORS[type] : "var(--band)";
}
