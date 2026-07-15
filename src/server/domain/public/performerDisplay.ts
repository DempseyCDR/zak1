import { inArray } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { performers } from "@/server/db/schema";
import type { BookingView } from "@/server/domain/bookings/bookingService";
import { PERFORMER_RULES } from "@/server/domain/performers/performerRules";

export type PublicPerformer =
  | { kind: "full_bio"; name: string; bio: string | null; photoUrl: string | null }
  | { kind: "open_band" }
  | { kind: "name_note"; name: string; note: string | null };

/**
 * Map an event's non-band bookings to public performer entries per FR-003, using feature 003's
 * PERFORMER_RULES.publicDisplay. `hidden` performers (Sound Tech) are dropped entirely — they never
 * appear in any public output. Only public-safe fields are returned (never pay/contact/etc.).
 */
export async function mapPublicPerformers(
  db: Db,
  adHocBookings: BookingView[],
): Promise<PublicPerformer[]> {
  // Bio/photo for the full_bio entries, fetched once.
  const performerIds = [...new Set(adHocBookings.map((b) => b.performerId))];
  const bioById = new Map<string, { bio: string | null; photoUrl: string | null }>();
  if (performerIds.length > 0) {
    const rows = await db
      .select({ id: performers.id, bio: performers.bio, photoUrl: performers.photoUrl })
      .from(performers)
      .where(inArray(performers.id, performerIds));
    for (const r of rows) bioById.set(r.id, { bio: r.bio, photoUrl: r.photoUrl });
  }

  const result: PublicPerformer[] = [];
  for (const b of adHocBookings) {
    const rule = PERFORMER_RULES[b.performerType].publicDisplay;
    switch (rule) {
      case "full_bio": {
        const p = bioById.get(b.performerId);
        result.push({
          kind: "full_bio",
          name: b.performerName,
          bio: p?.bio ?? null,
          photoUrl: p?.photoUrl ?? null,
        });
        break;
      }
      case "open_band_label":
        result.push({ kind: "open_band" });
        break;
      case "name_note":
        result.push({ kind: "name_note", name: b.performerName, note: b.note });
        break;
      case "hidden":
        // omitted entirely (e.g., Sound Tech)
        break;
    }
  }
  return result;
}
