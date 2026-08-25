import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { db } from "@/server/db/client";
import { getPublicEventDetail } from "@/server/domain/public/publicSchedule";
import { seriesColorVar } from "../../_components/seriesColor";
import Container from "../../_components/Container";
import EventHero from "../../_components/EventHero";
import VenueBlock from "../../_components/VenueBlock";
import Lineup from "../../_components/Lineup";
import PricingBlock from "../../_components/PricingBlock";
import styles from "./eventDetail.module.css";

/**
 * Feature 049 (P7-R5): the enriched public event page — the shareable destination of every R4 card. A
 * series-default hero (or a clean series-colored header), the title + a series-color accent (matching the
 * card, single source via `seriesColorVar`), date/time/price, description, the venue block (name + map
 * link), and the confirmed lineup (bands + members + callers). Confirmed-only + cancelled marker retained;
 * unknown id → not-found.
 */
export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const detail = await getPublicEventDetail(db, eventId);
  if (!detail) notFound();

  const accent = { "--series-accent": seriesColorVar(detail.seriesKey) } as CSSProperties;

  return (
    <>
      <EventHero seriesKey={detail.seriesKey} activity={detail.activity} />
      <Container>
        <article style={accent}>
          <h1 className={styles.title}>
            {detail.activity}
            {detail.label ? ` — ${detail.label}` : ""}
          </h1>
          <p className={styles.meta}>
            {detail.date}
            {detail.startTime ? ` · ${detail.startTime}` : ""}
          </p>

          {detail.cancelled ? (
            <p className={styles.cancelled}>This event has been cancelled.</p>
          ) : null}

          {/* Feature 054 (P7-R10): full admission pricing from the single source (nothing when unconfigured). */}
          <PricingBlock pricing={detail.pricing} />

          {/* Feature 052 (P7-R8): VenueBlock renders the gated venue — name always; address/map/directions
              only for a public venue. */}
          <VenueBlock venue={detail.venue} />
          <Lineup bandBlocks={detail.bandBlocks} performers={detail.performers} />
        </article>
      </Container>
    </>
  );
}
