import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReqAs, ctx } from "./helpers/http";
import { makeActor, makeEvent, makePerformer } from "./helpers/factories";
import { createBooking } from "@/server/domain/bookings/bookingService";
import { bookings, series } from "@/server/db/schema";
import { POST as CREATE } from "@/app/api/performer-payments/route";
import { PATCH, DELETE } from "@/app/api/performer-payments/[id]/route";
import { GET as LIST } from "@/app/api/events/[id]/performer-payments/route";

async function seriesId(key: string): Promise<string> {
  const s = await db.query.series.findFirst({ where: eq(series.key, key) });
  if (!s) throw new Error(`series ${key} missing`);
  return s.id;
}

// Feature 019 US2 (FR-005..FR-009): actual disbursements, separate from bookings. Substitute payee, one
// check across bookings; booked pay_cents never altered; treasurer reconciliation.
describe("performer payments", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  async function fsToken() {
    const { token } = await makeActor({
      email: "fs@ex.com",
      grants: [{ role: "financial_secretary", seriesId: await seriesId("tnc") }],
    });
    return token;
  }

  async function book(eventId: string, performerId: string, pay: number) {
    return createBooking(db, eventId, { performerId, performerType: "musician", pay }, "test");
  }

  it("records a payment to a SUBSTITUTE payee without touching the booking", async () => {
    const token = await fsToken();
    const event = await makeEvent();
    const booked = await makePerformer("Booked Betty");
    const sub = await makePerformer("Substitute Sue");
    const b = await book(event.id, booked.id, 125);

    const res = await CREATE(
      jsonReqAs(token, "POST", "/api/performer-payments", {
        eventId: event.id,
        payeePerformerId: sub.id,
        amount: 125,
        checkNumber: "1001",
        overrideReason: "Betty snowed in",
        bookingIds: [b.id],
      }),
      ctx(),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.payeePerformerId).toBe(sub.id);

    // FR-007 / SC-003: the booking's rate is unchanged.
    const row = await db.query.bookings.findFirst({ where: eq(bookings.id, b.id) });
    expect(row?.payCents).toBe(12500);
    expect(row?.performerId).toBe(booked.id);
  });

  it("aggregates several bookings under one check", async () => {
    const token = await fsToken();
    const event = await makeEvent();
    const p1 = await makePerformer("P1");
    const p2 = await makePerformer("P2");
    const b1 = await book(event.id, p1.id, 125);
    const b2 = await book(event.id, p2.id, 125);

    const res = await CREATE(
      jsonReqAs(token, "POST", "/api/performer-payments", {
        eventId: event.id,
        payeePerformerId: p1.id,
        amount: 250,
        checkNumber: "1002",
        bookingIds: [b1.id, b2.id],
      }),
      ctx(),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.bookingIds).toHaveLength(2);
  });

  it("refuses a booking from a different event (422 BOOKING_EVENT_MISMATCH)", async () => {
    const token = await fsToken();
    const event = await makeEvent();
    const other = await makeEvent({ eventDate: "2026-06-25" });
    const p = await makePerformer("P");
    const bOther = await book(other.id, p.id, 100);

    const res = await CREATE(
      jsonReqAs(token, "POST", "/api/performer-payments", {
        eventId: event.id,
        payeePerformerId: p.id,
        amount: 100,
        bookingIds: [bOther.id],
      }),
      ctx(),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("BOOKING_EVENT_MISMATCH");
  });

  it("GET lists payments with a reconciliation delta", async () => {
    const token = await fsToken();
    const event = await makeEvent();
    const p = await makePerformer("P");
    const b = await book(event.id, p.id, 125); // expected 12500
    await CREATE(
      jsonReqAs(token, "POST", "/api/performer-payments", {
        eventId: event.id,
        payeePerformerId: p.id,
        amount: 100, // actual under expected → delta -2500
        bookingIds: [b.id],
      }),
      ctx(),
    );
    const res = await LIST(
      jsonReqAs(token, "GET", `/api/events/${event.id}/performer-payments`),
      ctx({ id: event.id }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.payments).toHaveLength(1);
    expect(body.reconciliation).toEqual({ expected: 125, actual: 100, delta: -25 });
  });

  it("PATCH replaces the linked booking set", async () => {
    const token = await fsToken();
    const event = await makeEvent();
    const p1 = await makePerformer("P1");
    const p2 = await makePerformer("P2");
    const b1 = await book(event.id, p1.id, 125);
    const b2 = await book(event.id, p2.id, 125);
    const created = await (
      await CREATE(
        jsonReqAs(token, "POST", "/api/performer-payments", {
          eventId: event.id,
          payeePerformerId: p1.id,
          amount: 125,
          bookingIds: [b1.id],
        }),
        ctx(),
      )
    ).json();

    const res = await PATCH(
      jsonReqAs(token, "PATCH", `/api/performer-payments/${created.id}`, { bookingIds: [b2.id] }),
      ctx({ id: created.id }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).bookingIds).toEqual([b2.id]);
  });

  it("DELETE removes the payment and its links", async () => {
    const token = await fsToken();
    const event = await makeEvent();
    const p = await makePerformer("P");
    const b = await book(event.id, p.id, 125);
    const created = await (
      await CREATE(
        jsonReqAs(token, "POST", "/api/performer-payments", {
          eventId: event.id,
          payeePerformerId: p.id,
          amount: 125,
          bookingIds: [b.id],
        }),
        ctx(),
      )
    ).json();
    const res = await DELETE(
      jsonReqAs(token, "DELETE", `/api/performer-payments/${created.id}`),
      ctx({ id: created.id }),
    );
    expect(res.status).toBe(204);
  });

  it("refuses an FS scoped to a DIFFERENT series (layer-2 scope)", async () => {
    const { token } = await makeActor({
      email: "fsecd@ex.com",
      grants: [{ role: "financial_secretary", seriesId: await seriesId("ecd") }],
    });
    const event = await makeEvent({ seriesKey: "tnc" }); // FS holds ecd, not tnc
    const p = await makePerformer("P");
    const b = await book(event.id, p.id, 125);
    const res = await CREATE(
      jsonReqAs(token, "POST", "/api/performer-payments", {
        eventId: event.id,
        payeePerformerId: p.id,
        amount: 125,
        bookingIds: [b.id],
      }),
      ctx(),
    );
    expect(res.status).toBe(403);
  });
});
