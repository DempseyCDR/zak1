import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withPublic } from "@/server/auth/withPublic";
import { parseBody } from "@/server/lib/parseBody";
import { rateLimit } from "@/server/lib/rateLimit";
import { membershipCaptureSchema } from "@/server/validation/membershipPublic";
import { createCapture } from "@/server/domain/paypal/captureService";

// Feature 019 US3 (FR-010, R2): PUBLIC — no session. The one unauthenticated write in the app. Returns
// ONLY the capture id (never whether the email matched a member — that would make it a membership oracle).
export const POST = withPublic(async (req) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`membership-capture:${ip}`, 10, 60_000)) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many requests; try again shortly." } },
      { status: 429 },
    );
  }
  const input = await parseBody(req, membershipCaptureSchema);
  const capture = await createCapture(db, input);
  return NextResponse.json({ captureId: capture.id }, { status: 201 });
});
