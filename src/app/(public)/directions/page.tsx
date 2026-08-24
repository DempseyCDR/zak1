import { db } from "@/server/db/client";
import { listPublicVenues } from "@/server/domain/public/publicVenues";
import Container from "../_components/Container";
import styles from "./directions.module.css";

/**
 * Feature 052 (P7-R8): the public directions page — the club's directory of **public** venues only (name,
 * address, map link, directions). `listPublicVenues` is the gate: it returns only venues marked public that
 * have an address, so a private-home address never reaches this page.
 */
export default async function DirectionsPage() {
  const venues = await listPublicVenues(db);
  return (
    <Container>
      <h1>Directions</h1>
      {venues.length === 0 ? (
        <p className={styles.empty}>No venues to show yet.</p>
      ) : (
        <ul className={styles.list}>
          {venues.map((v, i) => (
            <li key={`${v.name}-${i}`} className={styles.venue}>
              <h2 className={styles.name}>{v.name}</h2>
              {v.address ? <p className={styles.address}>{v.address}</p> : null}
              {v.mapUrl ? (
                <p>
                  <a className={styles.mapLink} href={v.mapUrl} target="_blank" rel="noreferrer">
                    View map
                  </a>
                </p>
              ) : null}
              {v.directions ? <p className={styles.directions}>{v.directions}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
