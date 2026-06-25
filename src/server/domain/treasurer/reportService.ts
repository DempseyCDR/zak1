import { eq } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import {
  bookings,
  doorRecords,
  events,
  gateSales,
  nonDanceIncome,
  performers,
  series,
  seriesQboMap,
  treasurerReportAudit,
} from "@/server/db/schema";
import type { GateCategory } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { writeAudit } from "@/server/lib/audit";
import { centsToDollars } from "@/server/lib/money";
import { loadAccountMap } from "./mappingService";

// Categories shown on the anonymous gate receipt (membership/future_event are named-customer).
const GATE_SUMMARY_CATEGORIES: GateCategory[] = [
  "today_admission",
  "merchandise",
  "donation",
  "gift_card",
  "misc_sales",
];
const NAMED_CUSTOMER_CATEGORIES: GateCategory[] = ["membership", "future_event"];

export type TreasurerReport = {
  event: { id: string; date: string; seriesKey: string };
  gateSalesSummary: {
    customer: string;
    posVerification: { gross: number; fee: number };
    lines: { category: string; account: string; class: string; cash: number; card: number; total: number }[];
  };
  namedCustomerReceipts: { kind: string; account: string; class: string; amount: number }[];
  performerPayments: {
    payee: string;
    amount: number;
    account: string;
    class: string;
    checkNumber: string | null;
  }[];
  deposit: { account: string; amount: number };
  fees: { account: string; doorFee: number; onlineFee: number; total: number };
  nonDanceIncome: {
    account: string;
    lines: { description: string; amount: number; date: string }[];
    total: number;
  };
};

export async function assembleTreasurerReport(
  db: Db,
  eventId: string,
  actor: string | null = null,
): Promise<TreasurerReport> {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) throw errors.eventNotFound();
  const s = await db.query.series.findFirst({ where: eq(series.id, event.seriesId) });
  const qbo = await db.query.seriesQboMap.findFirst({
    where: eq(seriesQboMap.seriesId, event.seriesId),
  });
  const gateCustomer = qbo?.gateCustomer ?? "Gate";
  const qboClass = qbo?.qboClass ?? "";

  const door = await db.query.doorRecords.findFirst({ where: eq(doorRecords.eventId, eventId) });
  if (!door) throw errors.doorRecordNotFound();

  const sales = await db.select().from(gateSales).where(eq(gateSales.doorRecordId, door.id));
  const accountMap = await loadAccountMap(db);
  const account = (key: string) => accountMap.get(key)?.accountCode ?? "UNMAPPED";

  // Sum a category's cash/card cents.
  function sumCategory(cat: GateCategory): { cash: number; card: number } {
    let cash = 0;
    let card = 0;
    for (const row of sales) {
      if (row.category !== cat) continue;
      if (row.paymentMethod === "cash") cash += row.amountCents;
      else card += row.amountCents;
    }
    return { cash, card };
  }

  const gateLines = GATE_SUMMARY_CATEGORIES.flatMap((cat) => {
    const { cash, card } = sumCategory(cat);
    if (cash === 0 && card === 0) return [];
    return [
      {
        category: cat,
        account: account(cat),
        class: qboClass,
        cash: centsToDollars(cash),
        card: centsToDollars(card),
        total: centsToDollars(cash + card),
      },
    ];
  });

  const namedCustomerReceipts = NAMED_CUSTOMER_CATEGORIES.flatMap((cat) => {
    const { cash, card } = sumCategory(cat);
    if (cash === 0 && card === 0) return [];
    return [{ kind: cat, account: account(cat), class: qboClass, amount: centsToDollars(cash + card) }];
  });

  const bookingRows = await db
    .select({
      payee: performers.displayName,
      payCents: bookings.payCents,
      performerType: bookings.performerType,
      checkNumber: bookings.checkNumber,
    })
    .from(bookings)
    .innerJoin(performers, eq(performers.id, bookings.performerId))
    .where(eq(bookings.eventId, eventId));

  const performerPayments = bookingRows
    .filter((b) => b.payCents > 0)
    .map((b) => ({
      payee: b.payee,
      amount: centsToDollars(b.payCents),
      account: account(b.performerType),
      class: qboClass,
      checkNumber: b.checkNumber,
    }));

  const ndiRows = await db.select().from(nonDanceIncome).where(eq(nonDanceIncome.eventId, eventId));
  const ndiTotal = ndiRows.reduce((a, r) => a + r.amountCents, 0);

  await db.insert(treasurerReportAudit).values({ eventId, actor });
  writeAudit({ kind: "treasurer_report.generated", actor, details: { eventId } });

  return {
    event: { id: event.id, date: event.eventDate, seriesKey: s?.key ?? "" },
    gateSalesSummary: {
      customer: gateCustomer,
      posVerification: {
        gross: centsToDollars(door.posGrossCents),
        fee: centsToDollars(door.posFeeCents),
      },
      lines: gateLines,
    },
    namedCustomerReceipts,
    performerPayments,
    deposit: { account: account("deposit"), amount: centsToDollars(door.depositCents) },
    fees: {
      account: account("fees"),
      doorFee: centsToDollars(door.posFeeCents),
      onlineFee: 0, // online orders arrive with feature 007
      total: centsToDollars(door.posFeeCents),
    },
    nonDanceIncome: {
      account: account("non_dance_income"),
      lines: ndiRows.map((r) => ({
        description: r.description,
        amount: centsToDollars(r.amountCents),
        date: r.entryDate,
      })),
      total: centsToDollars(ndiTotal),
    },
  };
}
