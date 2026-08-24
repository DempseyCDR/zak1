import type { PublicVenue } from "@/server/domain/public/publicSchedule";
import styles from "./VenueBlock.module.css";

/**
 * Feature 049 (P7-R5) + 052 (P7-R8): the event page's venue block. Shows the venue **name always**; the
 * **address** (as a tappable map link) and the **directions** note only for a **public** venue — for a
 * non-public venue the gated projection (`publicVenueView`) returns them as null, so a private-home address
 * is never shown here. Renders nothing when the event has no venue.
 */
export default function VenueBlock({ venue }: { venue: PublicVenue | null }) {
  if (!venue) return null;
  return (
    <section className={styles.venue}>
      <h2 className={styles.heading}>Venue</h2>
      <p className={styles.name}>{venue.name}</p>
      {venue.address && venue.mapUrl ? (
        <a className={styles.mapLink} href={venue.mapUrl} target="_blank" rel="noreferrer">
          {venue.address}
        </a>
      ) : null}
      {venue.directions ? <p className={styles.directions}>{venue.directions}</p> : null}
    </section>
  );
}
