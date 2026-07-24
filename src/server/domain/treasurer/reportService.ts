import { eq } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import {
  bookings,
  contacts,
  doorRecords,
  events,
  gateSales,
  nonDanceIncome,
  paymentBookings,
  performerPayments,
  performers,
  series,
  seriesQboMap,
  treasurerReportAudit,
} from "@/server/db/schema";
import type { GateCategory } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { writeAudit } from "@/server/lib/audit";
import { centsToDollars } from "@/server/lib/money";
import { computeEventGate } from "@/server/domain/gate/eventMoney";
import { reconcilePayments } from "@/server/domain/payments/reconcile";
import { loadAccountMap } from "./mappingService";

// Anonymous non-admission categories shown on the gate receipt (admission is derived).
const ANON_CATEGORIES: GateCategory[] = ["merchandise", "gift_card", "misc_sales"];
// Named-customer receipts (sold to a contact): donation, future_event, membership.
const NAMED_CUSTOMER_CATEGORIES: GateCategory[] = ["donation", "future_event", "membership"];

export type TreasurerReport = {
  event: { id: string; date: string; seriesKey: string };
  gateSalesSummary: {
    customer: string;
    posVerification: { gross: number; fee: number };
    lines: {
      category: string;
      account: string;
      class: string;
      cash: number;
      card: number;
      total: number;
    }[];
  };
  namedCustomerReceipts: {
    kind: string;
    contact: string;
    contactId: string | null;
    account: string;
    class: string;
    amount: number;
  }[];
  performerPayments: {
    payee: string;
    amount: number;
    account: string;
    class: string;
    checkNumber: string | null;
  }[];
  // Feature 019 US2 (FR-008): expected (sum of booked obligations) vs. actual (sum of recorded payments).
  // A non-zero delta surfaces a gap — e.g. performers booked but not yet paid.
  performerReconciliation: { expected: number; actual: number; delta: number };
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

  // Admission is derived (shared with the organizer report via eventMoney).
  const gate = await computeEventGate(db, eventId);
  const admissionCash = gate.admissionCashCents;
  const admissionCard = gate.admissionCardCents;

  const gateLines = [
    {
      category: "admission",
      account: account("admission"),
      class: qboClass,
      cash: centsToDollars(admissionCash),
      card: centsToDollars(admissionCard),
      total: centsToDollars(admissionCash + admissionCard),
    },
    ...ANON_CATEGORIES.flatMap((cat) => {
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
    }),
  ];

  // Named-customer receipts: group named-category lines by (contact, category).
  const namedRows = await db
    .select({
      category: gateSales.category,
      amountCents: gateSales.amountCents,
      contactId: gateSales.contactId,
      contactName: contacts.displayName,
    })
    .from(gateSales)
    .leftJoin(contacts, eq(contacts.id, gateSales.contactId))
    .where(eq(gateSales.doorRecordId, door.id));

  const namedMap = new Map<
    string,
    { kind: GateCategory; contact: string; contactId: string | null; amountCents: number }
  >();
  for (const r of namedRows) {
    if (!NAMED_CUSTOMER_CATEGORIES.includes(r.category)) continue;
    const key = `${r.category}:${r.contactId ?? "none"}`;
    const existing = namedMap.get(key);
    if (existing) existing.amountCents += r.amountCents;
    else
      namedMap.set(key, {
        kind: r.category,
        contact: r.contactName ?? "(unknown)",
        contactId: r.contactId,
        amountCents: r.amountCents,
      });
  }
  const namedCustomerReceipts = [...namedMap.values()].map((n) => ({
    kind: n.kind,
    contact: n.contact,
    contactId: n.contactId,
    account: account(n.kind),
    class: qboClass,
    amount: centsToDollars(n.amountCents),
  }));

  // Feature 019 US2 (FR-008): performer lines now come from ACTUAL payments (performer_payments), not from
  // the booking's expected pay. A payment's account maps from the performer type of a booking it settles —
  // the one performed by the payee if present (the normal/backfilled case), else the first linked booking
  // (an aggregated check across types; QBO reconciliation splits it). Booked pay feeds the reconciliation.
  const bookingRows = await db
    .select({
      id: bookings.id,
      performerId: bookings.performerId,
      payCents: bookings.payCents,
      performerType: bookings.performerType,
    })
    .from(bookings)
    .where(eq(bookings.eventId, eventId));
  const bookingById = new Map(bookingRows.map((b) => [b.id, b]));

  const paymentRows = await db
    .select({
      id: performerPayments.id,
      payee: performers.displayName,
      payeePerformerId: performerPayments.payeePerformerId,
      amountCents: performerPayments.amountCents,
      checkNumber: performerPayments.checkNumber,
    })
    .from(performerPayments)
    .innerJoin(performers, eq(performers.id, performerPayments.payeePerformerId))
    .where(eq(performerPayments.eventId, eventId));

  const links = await db
    .select({ paymentId: paymentBookings.paymentId, bookingId: paymentBookings.bookingId })
    .from(paymentBookings)
    .innerJoin(bookings, eq(bookings.id, paymentBookings.bookingId))
    .where(eq(bookings.eventId, eventId));
  const bookingsForPayment = new Map<string, string[]>();
  for (const l of links) {
    const list = bookingsForPayment.get(l.paymentId) ?? [];
    list.push(l.bookingId);
    bookingsForPayment.set(l.paymentId, list);
  }

  const performerPaymentLines = paymentRows.map((p) => {
    const linked = (bookingsForPayment.get(p.id) ?? []).map((id) => bookingById.get(id)!);
    const forAccount = linked.find((b) => b.performerId === p.payeePerformerId) ?? linked[0];
    return {
      payee: p.payee,
      amount: centsToDollars(p.amountCents),
      account: forAccount ? account(forAccount.performerType) : "UNMAPPED",
      class: qboClass,
      checkNumber: p.checkNumber,
    };
  });

  const performerReconciliation = (() => {
    const r = reconcilePayments(
      bookingRows.map((b) => b.payCents),
      paymentRows.map((p) => p.amountCents),
    );
    return {
      expected: centsToDollars(r.expectedCents),
      actual: centsToDollars(r.actualCents),
      delta: centsToDollars(r.deltaCents),
    };
  })();

  const ndiRows = await db.select().from(nonDanceIncome).where(eq(nonDanceIncome.eventId, eventId));
  const ndiTotal = ndiRows.reduce((a, r) => a + r.amountCents, 0);

  await db.insert(treasurerReportAudit).values({ eventId, actor });
  writeAudit({ kind: "treasurer_report.generated", actor, details: { eventId } });

  return {
    event: { id: event.id, date: event.eventDate, seriesKey: s?.key ?? "" },
    gateSalesSummary: {
      customer: gateCustomer,
      posVerification: {
        gross: centsToDollars(door.pcGrossCents),
        fee: centsToDollars(door.posFeeCents),
      },
      lines: gateLines,
    },
    namedCustomerReceipts,
    performerPayments: performerPaymentLines,
    performerReconciliation,
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
