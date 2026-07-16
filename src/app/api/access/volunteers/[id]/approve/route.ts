import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { approveVolunteer } from "@/server/domain/access/grantService";

// Record the annual Presidential approval of a volunteer (FR-035). ADVISORY: nothing on the session
// path reads the columns this writes (FR-037) — a lapsed approval never costs access.
export const POST = withAuth<{ id: string }>(
  { requires: "volunteer.approve" },
  async (_req, ctx) => {
    const { id } = await ctx.params;
    await approveVolunteer(db, id, ctx.staff.contactId);
    return NextResponse.json({ ok: true });
  },
);
