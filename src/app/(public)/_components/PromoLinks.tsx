import type { PromoLink, PromoLinkType } from "@/server/domain/public/promoLinks";
import styles from "./PromoLinks.module.css";

/**
 * Feature 053 (P7-R9): a performer's self-published promotional links as safe outbound anchors. The URL scheme
 * is already allowlisted to http(s) at the write boundary (promoLinks.ts), so this only presents it. Every
 * anchor is `target="_blank" rel="noopener noreferrer nofollow"` — third-party destinations we neither vouch
 * for (nofollow) nor expose our window/referrer to (noopener noreferrer). No `dangerouslySetInnerHTML`.
 */

const LABELS: Record<PromoLinkType, string> = {
  website: "Website",
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  bandcamp: "Bandcamp",
  spotify: "Spotify",
  other: "Link",
};

export default function PromoLinks({ links }: { links: PromoLink[] }) {
  if (links.length === 0) return null;
  return (
    <ul className={styles.links}>
      {links.map((l, i) => (
        <li key={`${l.type}-${i}`}>
          <a
            className={styles.link}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
          >
            {LABELS[l.type]}
          </a>
        </li>
      ))}
    </ul>
  );
}
