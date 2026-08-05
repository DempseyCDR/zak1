import { db } from "@/server/db/client";
import { getPublicSchedule, listSeries } from "@/server/domain/public/publicSchedule";
import ScheduleList from "../_components/ScheduleList";
import SeriesFilter from "../_components/SeriesFilter";

// Server Component: reads the public schedule directly (no client bundle, no private data). Feature 037
// (P6-R5): an optional `?series=` filter (server-rendered) narrows the list; the list + filter are shared
// with /what-was-on.
export default async function WhatsOnPage({
  searchParams,
}: {
  searchParams: Promise<{ series?: string }>;
}) {
  const { series } = await searchParams;
  const [schedule, allSeries] = await Promise.all([
    getPublicSchedule(db, undefined, series),
    listSeries(db),
  ]);

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1>What&apos;s on</h1>
      <SeriesFilter series={allSeries} selected={series} basePath="/whats-on" />
      <ScheduleList items={schedule} emptyMessage="No dances to show." />
    </main>
  );
}
