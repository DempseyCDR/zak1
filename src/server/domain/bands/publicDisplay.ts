import type { Db } from "@/server/db/client";
import { getBookingsForEvent, type BookingView } from "@/server/domain/bookings/bookingService";
import { getBand } from "./bandService";

export type BandBlock = {
  bandId: string;
  name: string;
  bio: string | null;
  photoUrl: string | null;
};
export type EventPublicPerformers = { bandBlocks: BandBlock[]; adHoc: BookingView[] };

/**
 * Group an event's bookings for public display (FR-007/FR-008): one block per distinct band
 * (its CURRENT identity — live read), plus ad-hoc (non-band) bookings listed individually.
 * A read model for feature 007 to consume; band identity is not snapshotted.
 */
export async function groupEventBookingsForDisplay(
  db: Db,
  eventId: string,
): Promise<EventPublicPerformers> {
  const { bookings } = await getBookingsForEvent(db, eventId);
  // Feature 018 (FR-022): the public shows only CONFIRMED bookings — proposed/requested/declined
  // performers are not advertised. (Internal reports still use all statuses via getBookingsForEvent.)
  const confirmed = bookings.filter((b) => b.status === "confirmed");

  const adHoc = confirmed.filter((b) => b.bandId === null);
  const bandIds = [
    ...new Set(confirmed.filter((b) => b.bandId !== null).map((b) => b.bandId as string)),
  ];

  const bandBlocks: BandBlock[] = [];
  for (const bandId of bandIds) {
    const band = await getBand(db, bandId); // current identity, live
    bandBlocks.push({ bandId, name: band.name, bio: band.bio, photoUrl: band.photoUrl });
  }

  return { bandBlocks, adHoc };
}
