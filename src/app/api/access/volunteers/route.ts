import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { errors } from "@/server/lib/apiError";
import { volunteerDesignateSchema } from "@/server/validation/access";
import {
  clearVolunteer,
  designateVolunteer,
  grantsForContact,
  listVolunteers,
} from "@/server/domain/access/grantService";

// The access-control roster: every volunteer with their grants, overdue flags, and duty-concentration
// flags (FR-031/FR-036). role.assign — this is who-holds-what, access-control information.
export const GET = withAuth({ requires: "role.assign" }, async () => {
  return NextResponse.json({ volunteers: await listVolunteers(db) });
});

// Designate a contact as a volunteer (FR-028).
export const POST = withAuth({ requires: "role.assign" }, async (req, { staff }) => {
  const { contactId } = await parseBody(req, volunteerDesignateSchema);
  await designateVolunteer(db, contactId, staff.contactId);
  return NextResponse.json({ ok: true }, { status: 201 });
});

// Clear a volunteer, cascading a revoke of ALL their grants (FR-028b). The UI must have shown the
// report of what will be revoked first (FR-028a); `?preview=1` returns that list without changing
// anything, so the screen can confirm before the destructive call.
export const DELETE = withAuth({ requires: "role.assign" }, async (req, { staff }) => {
  const url = new URL(req.url);
  const contactId = url.searchParams.get("contactId");
  if (!contactId) throw errors.validation("contactId is required");

  if (url.searchParams.get("preview") === "1") {
    return NextResponse.json({ willRevoke: await grantsForContact(db, contactId) });
  }
  const revoked = await clearVolunteer(db, contactId, staff.contactId);
  return NextResponse.json({ revoked });
});
