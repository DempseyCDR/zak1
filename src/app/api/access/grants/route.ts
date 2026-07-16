import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { errors } from "@/server/lib/apiError";
import { grantCreateSchema } from "@/server/validation/access";
import { grantRole, revokeRole } from "@/server/domain/access/grantService";

// Grant a role at a scope. President + VP only (role.assign; VP ⊇ President). The service enforces
// FR-005a exclusivity, the volunteer gate, and FR-030a (super_user is CLI-only).
export const POST = withAuth({ requires: "role.assign" }, async (req, { staff }) => {
  const input = await parseBody(req, grantCreateSchema);
  const result = await grantRole(db, {
    subjectContactId: input.subjectContactId,
    role: input.role,
    ...(input.seriesKey ? { seriesKey: input.seriesKey } : {}),
    ...(input.groupId ? { groupId: input.groupId } : {}),
    grantedBy: staff.contactId,
  });
  // The warning (FR-029a) is returned, not thrown — the grant succeeded.
  return NextResponse.json(
    { grant: result.grant, ...(result.warning ? { warning: result.warning } : {}) },
    { status: 201 },
  );
});

// Revoke a grant by id.
export const DELETE = withAuth({ requires: "role.assign" }, async (req, { staff }) => {
  const grantId = new URL(req.url).searchParams.get("grantId");
  if (!grantId) throw errors.validation("grantId is required");
  await revokeRole(db, grantId, staff.contactId);
  return NextResponse.json({ ok: true });
});
