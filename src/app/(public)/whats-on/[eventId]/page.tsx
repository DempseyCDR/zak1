import { notFound } from "next/navigation";
import { db } from "@/server/db/client";
import { getPublicEventDetail } from "@/server/domain/public/publicSchedule";
import Container from "../../_components/Container";
import styles from "./eventDetail.module.css";

export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const detail = await getPublicEventDetail(db, eventId);
  if (!detail) notFound();

  return (
    <Container>
      <h1>
        {detail.activity}
        {detail.label ? ` — ${detail.label}` : ""}
      </h1>
      <p className={styles.meta}>
        {detail.date}
        {detail.startTime ? ` · ${detail.startTime}` : ""}
        {detail.advertisedPrice != null ? ` · $${detail.advertisedPrice.toFixed(2)}` : ""}
      </p>

      {detail.cancelled && <p className={styles.cancelled}>This event has been cancelled.</p>}

      {detail.description && <p className={styles.description}>{detail.description}</p>}

      {detail.venue && (
        <section className={styles.section}>
          <h2>Venue</h2>
          {/* Feature 052 (P7-R8): name always; address/map/directions only for a public venue (else null). */}
          <p>
            {detail.venue.name}
            {detail.venue.address ? ` — ${detail.venue.address}` : ""}
          </p>
          {detail.venue.mapUrl && (
            <p>
              <a href={detail.venue.mapUrl} target="_blank" rel="noreferrer">
                View map
              </a>
            </p>
          )}
          {detail.venue.directions && (
            <p className={styles.description}>{detail.venue.directions}</p>
          )}
        </section>
      )}

      <section>
        <h2>Performers</h2>
        {detail.bandBlocks.map((b) => (
          <div key={b.name} className={styles.row}>
            <strong>{b.name}</strong>
            {b.bio && <p className={styles.bio}>{b.bio}</p>}
            {b.photoUrl && <img src={b.photoUrl} alt={b.name} className={styles.photo} />}
          </div>
        ))}
        {detail.performers.map((p, i) => {
          if (p.kind === "open_band") {
            return (
              <div key={`ob-${i}`} className={styles.row}>
                Open Band
              </div>
            );
          }
          if (p.kind === "name_note") {
            return (
              <div key={`nn-${i}`} className={styles.row}>
                <strong>{p.name}</strong>
                {p.note && <span> — {p.note}</span>}
              </div>
            );
          }
          return (
            <div key={`fb-${i}`} className={styles.row}>
              <strong>{p.name}</strong>
              {p.bio && <p className={styles.bio}>{p.bio}</p>}
              {p.photoUrl && <img src={p.photoUrl} alt={p.name} className={styles.photo} />}
            </div>
          );
        })}
      </section>
    </Container>
  );
}
