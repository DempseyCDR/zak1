import Link from "next/link";
import type { PublicCampaign } from "@/server/domain/campaigns/campaignService";
import styles from "./CampaignSlot.module.css";

// Feature 057 (P7-R14): the home-page promotional campaign slot. A SERVER component (no client behavior) — its
// heading/blurb/CTA are present in the SSR HTML (FR-011). The image is an external http(s) URL rendered with a
// plain lazy <img> (not next/image, whose remote-host allowlist can't cover editor-supplied hosts). The CTA is
// an internal path (same-tab in-app link) or an external http(s) URL (new tab, rel=noopener). Text-only when no
// image. Mounted only on the home page — never other public pages, never admin/door.

/** An internal path ('/…', not '//…') stays in-app; anything else is treated as an external link. */
function isInternal(url: string): boolean {
  return url.startsWith("/") && !url.startsWith("//");
}

export default function CampaignSlot({ campaign }: { campaign: PublicCampaign }) {
  const { heading, blurb, image, cta } = campaign;
  const internal = isInternal(cta.url);

  return (
    <section className={styles.slot} aria-label="Featured event">
      {/* Plain <img> (not next/image): the host is an editor-supplied external URL that next/image's
          remotePatterns allowlist can't cover. See the component note above. */}
      {image && <img className={styles.image} src={image.url} alt={image.alt} loading="lazy" />}
      <div className={styles.body}>
        <h2 className={styles.heading}>{heading}</h2>
        <p className={styles.blurb}>{blurb}</p>
        {internal ? (
          <Link className={styles.cta} href={cta.url}>
            {cta.label}
          </Link>
        ) : (
          <a className={styles.cta} href={cta.url} target="_blank" rel="noopener noreferrer">
            {cta.label}
          </a>
        )}
      </div>
    </section>
  );
}
