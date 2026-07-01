import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { makeEvent, makePerformer } from "./helpers/factories";
import { createBooking, getBookingsForEvent } from "@/server/domain/bookings/bookingService";
import { DELETE as DELETE_BOOKING } from "@/app/api/bookings/[id]/route";

// FR-017
describe("DELETE /api/bookings/:id", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("removes a booking so a replacement can be booked", async () => {
    const evt = await makeEvent();
    const p = await makePerformer("Cancelling Caller");
    const booking = await createBooking(db, evt.id, { performerId: p.id, performerType: "caller", pay: 150 });

    const res = await DELETE_BOOKING(jsonReq("DELETE", `/api/bookings/${booking.id}`), ctx({ id: booking.id }));
    expect(res.status).toBe(200);

    const view = await getBookingsForEvent(db, evt.id);
    expect(view.bookings).toHaveLength(0);
  });

  it("404s when the booking does not exist", async () => {
    const res = await DELETE_BOOKING(
      jsonReq("DELETE", "/api/bookings/00000000-0000-0000-0000-000000000000"),
      ctx({ id: "00000000-0000-0000-0000-000000000000" }),
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("BOOKING_NOT_FOUND");
  });
});
