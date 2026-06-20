import type { MembershipStatus } from "@/server/db/schema";

export type ClassifyInput = {
  /** Most recent membership expiry as 'YYYY-MM-DD', or null if no membership. */
  mostRecentExpiry: string | null;
  now: Date;
  longLapseCycles: number;
  /** Length of one lapse cycle, e.g. "1 year", "6 months", "30 days". */
  cycleDefinition: string;
};

type Unit = "year" | "month" | "week" | "day";

function parseCycle(def: string): { value: number; unit: Unit } {
  const m = def.trim().toLowerCase().match(/^(\d+)\s*(year|month|week|day)s?$/);
  if (!m) return { value: 1, unit: "year" };
  return { value: Number(m[1]), unit: m[2] as Unit };
}

/** Parse 'YYYY-MM-DD' into a UTC-midnight Date (avoids timezone drift). */
function parseDateUTC(ymd: string): Date {
  const [y, mo, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (mo ?? 1) - 1, d ?? 1));
}

function startOfDayUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addInterval(date: Date, count: number, unit: Unit): Date {
  const d = new Date(date);
  switch (unit) {
    case "year":
      d.setUTCFullYear(d.getUTCFullYear() + count);
      break;
    case "month":
      d.setUTCMonth(d.getUTCMonth() + count);
      break;
    case "week":
      d.setUTCDate(d.getUTCDate() + count * 7);
      break;
    case "day":
      d.setUTCDate(d.getUTCDate() + count);
      break;
  }
  return d;
}

/**
 * Classify a contact's membership status from its most recent expiry.
 * - never: no membership
 * - current: most recent expiry on/after today
 * - lapsed: expired, but within (longLapseCycles × cycle) of today
 * - long_lapsed: expired beyond that window
 */
export function classifyMembership(input: ClassifyInput): MembershipStatus {
  if (!input.mostRecentExpiry) return "never";
  const expiry = parseDateUTC(input.mostRecentExpiry);
  const today = startOfDayUTC(input.now);
  if (expiry.getTime() >= today.getTime()) return "current";

  const { value, unit } = parseCycle(input.cycleDefinition);
  const boundary = addInterval(expiry, value * input.longLapseCycles, unit);
  return today.getTime() <= boundary.getTime() ? "lapsed" : "long_lapsed";
}

export function isListMember(status: MembershipStatus): boolean {
  return status !== "never";
}
