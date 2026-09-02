import { NextResponse } from "next/server";
import { withAuth } from "@/server/auth/withAuth";
import { actorCan } from "@/server/auth/can";

// Feature 020 (FR-021): the report/modals render read-only for a viewer without write capability, with no
// edit affordance. The client learns which affordances to show from this small self-check. `actorCan` is
// layer-1 (holds the capability at SOME scope) — enough to decide whether to OFFER a control; the write
// itself is still scope-checked server-side, so this never grants anything.
export const GET = withAuth({ requires: "base" }, async (_req, ctx) => {
  return NextResponse.json({
    bookingWrite: actorCan(ctx.actor, "booking.write"),
    eventWrite: actorCan(ctx.actor, "event.write"),
    // Feature 065: which contact archive/delete controls the editor should offer.
    contactWrite: actorCan(ctx.actor, "contact.write"),
    contactDelete: actorCan(ctx.actor, "contact.delete"),
    contactDeleteUnrestricted: actorCan(ctx.actor, "contact.delete.unrestricted"),
  });
});
