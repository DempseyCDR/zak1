import { db } from "@/server/db/client";
import { getPublicHistory, listSeries } from "@/server/domain/public/publicSchedule";
import Container from "../_components/Container";
import ScheduleList from "../_components/ScheduleList";
import SeriesFilter from "../_components/SeriesFilter";

// Public dance history (feature 037, P6-R4): past dances (< today), most-recent-first, with an optional
// `?series=` filter (P6-R5). Server-rendered; rows link to the shared /whats-on/<eventId> detail page.
export default async function WhatWasOnPage({
  searchParams,
}: {
  searchParams: Promise<{ series?: string }>;
}) {
  const { series } = await searchParams;
  const [history, allSeries] = await Promise.all([
    getPublicHistory(db, undefined, series),
    listSeries(db),
  ]);

  return (
    <Container>
      <h1>What was on</h1>
      <SeriesFilter series={allSeries} selected={series} basePath="/what-was-on" />
      <ScheduleList items={history} emptyMessage="No past dances to show." />
    </Container>
  );
}
