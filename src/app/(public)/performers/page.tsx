import { db } from "@/server/db/client";
import { listPublicBands, listPublicCallers } from "@/server/domain/public/publicPerformers";
import { STYLE_TAGS, isStyleTag } from "@/server/domain/public/promoLinks";
import Container from "../_components/Container";
import RosterEntry from "../_components/RosterEntry";
import styles from "./performers.module.css";

/**
 * Feature 053 (P7-R9): the public performer roster — bands and callers, each with bio, photo, style tags, and
 * self-published promotional links. `listPublicBands`/`listPublicCallers` are the gate: only public
 * (non-archived) bands and public callers are returned, with NO contact info — so no PII can reach this page.
 * A `?style=` query narrows both sections (mirrors the 037 series filter); an unknown/absent value shows all.
 */
export default async function PerformersPage({
  searchParams,
}: {
  searchParams: Promise<{ style?: string }>;
}) {
  const { style } = await searchParams;
  const active = style && isStyleTag(style) ? style : undefined;
  const [bands, callers] = await Promise.all([
    listPublicBands(db, active),
    listPublicCallers(db, active),
  ]);
  const empty = bands.length === 0 && callers.length === 0;

  return (
    <Container>
      <h1>Performers</h1>

      <nav className={styles.filter} aria-label="Filter by dance style">
        <a className={!active ? styles.activeFilter : styles.filterLink} href="/performers">
          All
        </a>
        {STYLE_TAGS.map((s) => (
          <a
            key={s}
            className={active === s ? styles.activeFilter : styles.filterLink}
            href={`/performers?style=${s}`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </a>
        ))}
      </nav>

      {empty ? (
        <p className={styles.empty}>No performers to show yet.</p>
      ) : (
        <>
          {bands.length ? (
            <section className={styles.section}>
              <h2 className={styles.heading}>Bands</h2>
              {bands.map((b) => (
                <RosterEntry
                  key={b.bandId}
                  anchorId={`band-${b.bandId}`}
                  name={b.name}
                  bio={b.bio}
                  photoUrl={b.photoUrl}
                  styleTags={b.styles}
                  links={b.links}
                  members={b.members}
                />
              ))}
            </section>
          ) : null}
          {callers.length ? (
            <section className={styles.section}>
              <h2 className={styles.heading}>Callers</h2>
              {callers.map((c) => (
                <RosterEntry
                  key={c.performerId}
                  anchorId={`caller-${c.performerId}`}
                  name={c.name}
                  bio={c.bio}
                  photoUrl={c.photoUrl}
                  styleTags={c.styles}
                  links={c.links}
                />
              ))}
            </section>
          ) : null}
        </>
      )}
    </Container>
  );
}
