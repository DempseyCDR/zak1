import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { recurringEventsSchema } from "@/server/validation/door";
import { generateRecurringEvents } from "@/server/domain/events/eventService";

// Feature 018 (B26): generate many independent event rows. Booker, scoped to the target series
// (the service confirms `event.write` for THIS series). Refuses (422) a run over the per-run cap.
export const POST = withAuth({ requires: "event.write" }, async (req, { actor }) => {
  const input = await parseBody(req, recurringEventsSchema);
  const created = await generateRecurringEvents(db, input, actor);
  return NextResponse.json({ events: created }, { status: 201 });
});
