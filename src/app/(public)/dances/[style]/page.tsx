import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { db } from "@/server/db/client";
import { getPublicSchedule } from "@/server/domain/public/publicSchedule";
import { seriesColorVar } from "../../_components/seriesColor";
import Container from "../../_components/Container";
import EventHero from "../../_components/EventHero";
import LandingSections from "../../_components/LandingSections";
import ScheduleList from "../../_components/ScheduleList";
import { getStyleLanding } from "../landingContent";
import styles from "./styleLanding.module.css";

/**
 * Feature 050 (P7-R6): the per-style landing page ("What is contra?" / English / community). Resolves the
 * committed content registry (else `notFound()` — only the three covered styles exist), then presents the
 * series hero (049), one `<h1>` with a series-color accent (matching the card + event page), the migrated
 * prose (`LandingSections`), and this style's upcoming dances (`getPublicSchedule` filtered to the series →
 * the shared P7-R4 cards). Rendered per request so the upcoming-dances list stays fresh (no static prerender).
 */
export default async function StyleLandingPage({ params }: { params: Promise<{ style: string }> }) {
  const { style } = await params;
  const content = getStyleLanding(style);
  if (!content) notFound();

  const accent = { "--series-accent": seriesColorVar(content.seriesKey) } as CSSProperties;
  const upcoming = await getPublicSchedule(db, undefined, content.seriesKey);

  return (
    <>
      <EventHero seriesKey={content.seriesKey} activity={content.title} />
      <Container>
        <article style={accent}>
          <h1 className={styles.title}>{content.title}</h1>

          <LandingSections content={content} />

          <section className={styles.upcoming}>
            <h2 className={styles.heading}>Upcoming dances</h2>
            <ScheduleList
              items={upcoming}
              emptyMessage="No upcoming dances scheduled right now — check back soon."
            />
          </section>
        </article>
      </Container>
    </>
  );
}
