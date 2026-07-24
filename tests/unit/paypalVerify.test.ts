import { describe, expect, it } from "vitest";
import { interpretVerifyResponse } from "@/server/domain/paypal/verify";

// Feature 019 US3 (FR-011): the verification decision is a pure predicate, so it is testable without ever
// calling PayPal (Constitution v1.2.0 third-party boundary). Only PayPal's explicit SUCCESS counts.
describe("interpretVerifyResponse", () => {
  it("is true only for verification_status SUCCESS", () => {
    expect(interpretVerifyResponse({ verification_status: "SUCCESS" })).toBe(true);
  });

  it("is false for FAILURE, missing, or anything else", () => {
    expect(interpretVerifyResponse({ verification_status: "FAILURE" })).toBe(false);
    expect(interpretVerifyResponse({})).toBe(false);
    expect(interpretVerifyResponse({ verification_status: "success" })).toBe(false);
  });
});
