import type { PublicBandBlock } from "@/server/domain/public/publicSchedule";
import type { PublicPerformer } from "@/server/domain/public/performerDisplay";
import styles from "./Lineup.module.css";

/**
 * Feature 049 (P7-R5): the event page's confirmed lineup. Each booked band is grouped with its members
 * (lead first; name-only — performers carry no instrument today) and its bio/photo; then the callers /
 * other public performers. Renders "Lineup to be announced" when nothing is confirmed. Confirmed-only is
 * enforced upstream (`groupEventBookingsForDisplay`), so this component needs no status logic. No `<h1>`.
 */
export default function Lineup({
  bandBlocks,
  performers,
}: {
  bandBlocks: PublicBandBlock[];
  performers: PublicPerformer[];
}) {
  const empty = bandBlocks.length === 0 && performers.length === 0;
  return (
    <section className={styles.lineup}>
      <h2 className={styles.heading}>Lineup</h2>
      {empty ? (
        <p className={styles.tba}>Lineup to be announced.</p>
      ) : (
        <>
          {bandBlocks.map((b, i) => {
            const members = [...b.members].sort((a, z) => Number(z.isLead) - Number(a.isLead));
            return (
              <div key={`band-${i}`} className={styles.band}>
                <strong className={styles.name}>
                  {b.onPublicRoster ? (
                    <a href={`/performers#band-${b.bandId}`}>{b.name}</a>
                  ) : (
                    b.name
                  )}
                </strong>
                {b.photoUrl ? <img src={b.photoUrl} alt={b.name} className={styles.photo} /> : null}
                {b.bio ? <p className={styles.bio}>{b.bio}</p> : null}
                {members.length ? (
                  <ul className={styles.members}>
                    {members.map((m, mi) => (
                      <li key={`m-${mi}`}>
                        {m.name}
                        {m.instrument ? ` — ${m.instrument}` : ""}
                        {m.isLead ? " (lead)" : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
          {performers.map((p, i) => {
            if (p.kind === "open_band") {
              return (
                <div key={`perf-${i}`} className={styles.performer}>
                  Open Band
                </div>
              );
            }
            if (p.kind === "name_note") {
              return (
                <div key={`perf-${i}`} className={styles.performer}>
                  <strong>{p.name}</strong>
                  {p.note ? <span> — {p.note}</span> : null}
                </div>
              );
            }
            return (
              <div key={`perf-${i}`} className={styles.performer}>
                <strong>
                  {p.onPublicRoster ? (
                    <a href={`/performers#caller-${p.performerId}`}>{p.name}</a>
                  ) : (
                    p.name
                  )}
                </strong>
                {p.bio ? <p className={styles.bio}>{p.bio}</p> : null}
                {p.photoUrl ? <img src={p.photoUrl} alt={p.name} className={styles.photo} /> : null}
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}
