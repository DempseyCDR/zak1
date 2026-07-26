import { describe, expect, it } from "vitest";
import { isAllowedBookingTransition } from "@/server/domain/bookings/bookingStatus";

// Feature 018 (B23) booking lifecycle rules.
describe("isAllowedBookingTransition", () => {
  it("allows the forward path proposed → requested → confirmed", () => {
    expect(isAllowedBookingTransition("proposed", "requested")).toBe(true);
    expect(isAllowedBookingTransition("requested", "confirmed")).toBe(true);
  });

  it("rejects a skip (proposed → confirmed)", () => {
    expect(isAllowedBookingTransition("proposed", "confirmed")).toBe(false);
  });

  it("allows any non-terminal status → declined", () => {
    expect(isAllowedBookingTransition("proposed", "declined")).toBe(true);
    expect(isAllowedBookingTransition("requested", "declined")).toBe(true);
    expect(isAllowedBookingTransition("confirmed", "declined")).toBe(true);
  });

  it("allows declined → proposed (revive) but not declined → confirmed", () => {
    expect(isAllowedBookingTransition("declined", "proposed")).toBe(true);
    expect(isAllowedBookingTransition("declined", "confirmed")).toBe(false);
  });

  it("treats a same-status change as an idempotent no-op", () => {
    expect(isAllowedBookingTransition("confirmed", "confirmed")).toBe(true);
  });

  // Feature 020 (US3): 'tentative' — a "maybe" between requested and confirmed, skippable.
  it("allows requested → tentative → confirmed / declined", () => {
    expect(isAllowedBookingTransition("requested", "tentative")).toBe(true);
    expect(isAllowedBookingTransition("tentative", "confirmed")).toBe(true);
    expect(isAllowedBookingTransition("tentative", "declined")).toBe(true);
  });

  it("keeps requested → confirmed allowed (tentative is skippable)", () => {
    expect(isAllowedBookingTransition("requested", "confirmed")).toBe(true);
  });

  it("rejects entering tentative from anywhere but requested", () => {
    expect(isAllowedBookingTransition("proposed", "tentative")).toBe(false);
    expect(isAllowedBookingTransition("confirmed", "tentative")).toBe(false);
    expect(isAllowedBookingTransition("declined", "tentative")).toBe(false);
  });
});
