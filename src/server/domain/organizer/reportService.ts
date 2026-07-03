import { eq, inArray } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { events, miscExpenses, series } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { centsToDollars } from "@/server/lib/money";
import { computeEventGate } from "@/server/domain/gate/eventMoney";
import { getBookingsForEvent } from "@/server/domain/bookings/bookingService";
import { resolveParameterCents } from "@/server/domain/parameters/seriesParameterService";
import {
  avgTicketCents,
  breakEvenDancers,
  danceNetCents,
  payingDancers,
} from "./danceResult";
import { quarterlySummary, type QuarterlyRow } from "./quarterly";
import { buildTrend, type TrendPoint } from "./trend";

export type OrganizerReport = {
  series: { key: string; name: string };
  perDanceRows: unknown[];
  quarterlySummary: ReturnType<typeof quarterlySummary>;
  trend: ReturnType<typeof buildTrend>;
};

/** Series included in a report: the TNC report also includes its Community Dance events (FR-001). */
function includedKeys(seriesKey: string): string[] {
  return seriesKey === "tnc" ? ["tnc", "community_dance"] : [seriesKey];
}

export async function assembleOrganizerReport(
  db: Db,
  seriesKey: string,
  year: number,
): Promise<OrganizerReport> {
  const primary = await db.query.series.findFirst({ where: eq(series.key, seriesKey) });
  if (!primary) throw errors.seriesNotFound();

  const seriesRows = await db
    .select()
    .from(series)
    .where(inArray(series.key, includedKeys(seriesKey)));
  const seriesById = new Map(seriesRows.map((s) => [s.id, s]));
  const seriesIds = seriesRows.map((s) => s.id);

  const eventRows = (
    await db.select().from(events).where(inArray(events.seriesId, seriesIds))
  ).sort((a, b) => a.eventDate.localeCompare(b.eventDate));

  const rows = [];
  const quarterlyRows: QuarterlyRow[] = [];
  const trendPoints: TrendPoint[] = [];

  for (const ev of eventRows) {
    const gate = await computeEventGate(db, ev.id);
    const { bookings, performerTotal } = await getBookingsForEvent(db, ev.id);
    const performerTotalCents = bookings.reduce((a, b) => a + b.payCents, 0);
    const performerCount = new Set(bookings.map((b) => b.performerId)).size;
    const dancers = payingDancers(ev.attendanceCount, performerCount);

    const rentCents = await resolveParameterCents(db, {
      category: "expense",
      kind: "rent",
      seriesId: ev.seriesId,
      onDate: ev.eventDate,
    });
    const ongoingCents = await resolveParameterCents(db, {
      category: "expense",
      kind: "ongoing",
      seriesId: ev.seriesId,
      onDate: ev.eventDate,
    });
    const miscRows = await db.select().from(miscExpenses).where(eq(miscExpenses.eventId, ev.id));
    const miscCents = miscRows.reduce((a, m) => a + m.amountCents, 0) + gate.cardFeeCents;

    const net = danceNetCents({
      admissionCents: gate.admissionCents,
      merchandiseCents: gate.merchandiseCents,
      rentCents,
      performerTotalCents,
      ongoingCents,
      miscCents,
    });
    const avgTicket = avgTicketCents(gate.admissionCents, dancers);

    const caller = bookings.find((b) => b.performerType === "caller")?.performerName ?? "";
    const bandMembers = bookings
      .filter((b) => b.performerType === "lead_musician" || b.performerType === "musician")
      .map((b) => b.performerName);
    const band =
      bandMembers.length > 0
        ? bandMembers.join(", ")
        : bookings.some((b) => b.performerType === "open_band_musician")
          ? "Open Band"
          : "";

    const srow = seriesById.get(ev.seriesId);
    rows.push({
      eventId: ev.id,
      date: ev.eventDate,
      series: srow?.key ?? "",
      caller,
      band,
      dancers,
      grossGate: centsToDollars(gate.admissionCents),
      merchandise: centsToDollars(gate.merchandiseCents),
      rent: centsToDollars(rentCents),
      performerTotal, // dollars, from getBookingsForEvent
      ongoingExpense: centsToDollars(ongoingCents),
      miscExpenses: centsToDollars(miscCents),
      danceNet: centsToDollars(net),
      danceNetNegative: net < 0,
      avgTicket: centsToDollars(avgTicket),
      breakEvenDancers: breakEvenDancers(net, avgTicket),
      performers: bookings.map((b) => ({
        name: b.performerName,
        type: b.performerType,
        amount: centsToDollars(b.payCents),
      })),
      fyi: {
        donations: centsToDollars(gate.donationCents),
        memberships: centsToDollars(gate.membershipCents),
        futureEvent: centsToDollars(gate.futureEventCents),
        giftCards: centsToDollars(gate.giftCardCents),
        miscSales: centsToDollars(gate.miscSalesCents),
      },
    });

    quarterlyRows.push({
      date: ev.eventDate,
      dancers,
      gross: centsToDollars(gate.admissionCents),
      merchandise: centsToDollars(gate.merchandiseCents),
      rent: centsToDollars(rentCents),
      performerTotal,
      ongoing: centsToDollars(ongoingCents),
      misc: centsToDollars(miscCents),
      danceNet: centsToDollars(net),
      avgTicket: centsToDollars(avgTicket),
      fyi: {
        donations: centsToDollars(gate.donationCents),
        memberships: centsToDollars(gate.membershipCents),
        futureEvent: centsToDollars(gate.futureEventCents),
        giftCards: centsToDollars(gate.giftCardCents),
        miscSales: centsToDollars(gate.miscSalesCents),
      },
    });

    trendPoints.push({ date: ev.eventDate, danceNet: centsToDollars(net), dancers, caller, band });
  }

  return {
    series: { key: primary.key, name: primary.name },
    perDanceRows: rows,
    quarterlySummary: quarterlySummary(quarterlyRows, year),
    trend: buildTrend(trendPoints),
  };
}
