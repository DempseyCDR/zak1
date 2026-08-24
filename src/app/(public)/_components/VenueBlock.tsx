import type { PublicVenue } from "@/server/domain/public/publicSchedule";
import styles from "./VenueBlock.module.css";

/**
 * Feature 049 (P7-R5): the event page's venue block — the venue name and the address as a tappable link to
 * the map (`venue.mapUrl`, from `venueMapUrl`). A directions/transit/parking note is **P7-R8**
 * (`venues.directions`, not yet in the schema); this block reserves that slot and renders no note today.
 * Renders nothing when the event has no venue.
 */
export default function VenueBlock({ venue }: { venue: PublicVenue | null }) {
  if (!venue) return null;
  return (
    <section className={styles.venue}>
      <h2 className={styles.heading}>Venue</h2>
      <p className={styles.name}>{venue.name}</p>
      <a className={styles.mapLink} href={venue.mapUrl} target="_blank" rel="noreferrer">
        {venue.address}
      </a>
      {/* Directions/transit/parking note slot — P7-R8 (venues.directions). */}
    </section>
  );
}
