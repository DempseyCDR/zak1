import { describe, it, expect } from "vitest";
import { venueCreateSchema, venuePatchSchema } from "@/server/validation/venues";

// Feature 052 (P7-R8): the venue schemas gain isPublic + directions.
describe("venue schemas — public/directions", () => {
  it("create accepts isPublic + directions", () => {
    const r = venueCreateSchema.safeParse({
      name: "Rose Room",
      address: "295 Gregory St",
      isPublic: true,
      directions: "Park next door at the German House.",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.isPublic).toBe(true);
      expect(r.data.directions).toBe("Park next door at the German House.");
    }
  });

  it("patch accepts isPublic and directions (including null to clear)", () => {
    expect(venuePatchSchema.safeParse({ isPublic: false }).success).toBe(true);
    expect(venuePatchSchema.safeParse({ directions: "Take bus 12 to Gregory St." }).success).toBe(
      true,
    );
    expect(venuePatchSchema.safeParse({ directions: null }).success).toBe(true);
  });
});
