import { describe, expect, it } from "vitest";
import { danceNetCents } from "@/server/domain/organizer/danceResult";

// FR-003
describe("danceNetCents", () => {
  it("= admission + merchandise − rent − performer total − ongoing − misc", () => {
    expect(
      danceNetCents({
        admissionCents: 30000,
        merchandiseCents: 5000,
        rentCents: 8000,
        performerTotalCents: 25000,
        ongoingCents: 1000,
        miscCents: 500,
      }),
    ).toBe(30000 + 5000 - 8000 - 25000 - 1000 - 500); // 500
  });
});
