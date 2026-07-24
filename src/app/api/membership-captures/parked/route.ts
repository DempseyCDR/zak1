import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { listParkedNotifications } from "@/server/domain/paypal/captureService";

// Feature 019 US3 (FR-011): the parked-payment worklist. Capture data is PRE-CONTACT info, gated by
// membership.write (FS/Treasurer) — the people who act on parked money — deliberately not contact.pii.read.
export const GET = withAuth({ requires: "membership.write" }, async () => {
  const parked = await listParkedNotifications(db);
  return NextResponse.json({ parked });
});
