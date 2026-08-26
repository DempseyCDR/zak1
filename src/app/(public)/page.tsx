import Image from "next/image";
import Link from "next/link";
import { db } from "@/server/db/client";
import { getPublicSchedule } from "@/server/domain/public/publicSchedule";
import { getShownCampaign } from "@/server/domain/campaigns/campaignService";
import ScheduleList from "./_components/ScheduleList";
import NewHere from "./_components/NewHere";
import CampaignSlot from "./_components/CampaignSlot";
import styles from "./home.module.css";

// Feature 047 (P7-R3): the public home at `/`. Orientation-first for the growth funnel — a hero (tagline
// over one optimized image) and a "new here?" block precede the next-dances strip (reused schedule).
// Server component; reads the public schedule directly (no client bundle, no private data). The site-wide
// footer comes from the (public) layout.
const NEXT_DANCES = 4;

export default async function Home() {
  const [schedule, campaign] = await Promise.all([getPublicSchedule(db), getShownCampaign(db)]);
  const next = schedule.slice(0, NEXT_DANCES);

  return (
    <div className={styles.home}>
      {/* Feature 057 (P7-R14): the promotional campaign slot — above the hero, home page only. Nothing when
          no campaign is active. */}
      {campaign && <CampaignSlot campaign={campaign} />}
      <section className={styles.hero}>
        {/* Public asset (public/hero.webp) referenced by URL — Next serves & optimizes it; `fill` covers
            the band via home.module.css (object-fit: cover, --hero-focus). */}
        <Image
          src="/hero.webp"
          alt="Dancers at a Country Dancers of Rochester dance"
          fill
          priority
          sizes="100vw"
          className={styles.heroImg}
        />
        <div className={styles.heroScrim} />
        <div className={styles.heroContent}>
          <h1 className={styles.tagline}>All are welcome. If you can walk, you can dance.</h1>
          <Link href="/whats-on" className={styles.heroCta}>
            See upcoming dances
          </Link>
        </div>
      </section>

      <div className={styles.container}>
        <NewHere />

        <section className={styles.upcoming} aria-labelledby="upcoming-heading">
          <h2 id="upcoming-heading">Coming up</h2>
          <ScheduleList
            items={next}
            emptyMessage="No dances on the calendar just now — check back soon."
          />
          <Link href="/whats-on" className={styles.moreLink}>
            See the full schedule &rarr;
          </Link>
        </section>
      </div>
    </div>
  );
}
