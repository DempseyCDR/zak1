import { db } from "@/server/db/client";
import { getPrintableCalendar, resolveStart } from "@/server/domain/public/printableCalendar";
import PrintableCalendarView from "./PrintableCalendarView";

// Feature 058 (P7-R15): the print-friendly schedule at /printable-calendar. Async server component: read the
// optional ?start (forgiving — invalid/absent → today), assemble the single-sourced view model, and render it.
// Reserved slug (see RESERVED_SLUGS). Render-only.
export default async function PrintableCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawStart = Array.isArray(params.start) ? params.start[0] : params.start;
  const startISO = resolveStart(rawStart);
  const calendar = await getPrintableCalendar(db, startISO);

  return <PrintableCalendarView calendar={calendar} />;
}
