import type { PublicBandMember } from "@/server/domain/public/publicPerformers";
import type { PromoLink } from "@/server/domain/public/promoLinks";
import PromoLinks from "./PromoLinks";
import styles from "./RosterEntry.module.css";

/**
 * Feature 053 (P7-R9): one roster entry — a band (with members + instruments) or a caller. Renders only
 * public-safe fields from the gated projection (no contact info exists on the props to leak). The heading
 * carries a stable `id` anchor (`band-<id>` / `caller-<id>`) so an event lineup can deep-link to it.
 */
export default function RosterEntry({
  anchorId,
  name,
  bio,
  photoUrl,
  styleTags,
  links,
  members,
}: {
  anchorId: string;
  name: string;
  bio: string | null;
  photoUrl: string | null;
  styleTags: string[];
  links: PromoLink[];
  members?: PublicBandMember[];
}) {
  return (
    <article className={styles.entry}>
      <h3 id={anchorId} className={styles.name}>
        {name}
      </h3>
      {styleTags.length ? (
        <ul className={styles.styles}>
          {styleTags.map((s) => (
            <li key={s} className={styles.style}>
              {s}
            </li>
          ))}
        </ul>
      ) : null}
      {photoUrl ? <img src={photoUrl} alt={name} className={styles.photo} /> : null}
      {bio ? <p className={styles.bio}>{bio}</p> : null}
      {members && members.length ? (
        <ul className={styles.members}>
          {members.map((m, i) => (
            <li key={`m-${i}`}>
              {m.name}
              {m.instrument ? ` — ${m.instrument}` : ""}
              {m.isLead ? " (lead)" : ""}
            </li>
          ))}
        </ul>
      ) : null}
      <PromoLinks links={links} />
    </article>
  );
}
