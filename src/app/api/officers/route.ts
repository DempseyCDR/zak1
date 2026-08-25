import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { officerSetSchema } from "@/server/validation/officers";
import { BOARD_ROLES } from "@/server/domain/org/clubRoles";
import { listOfficerAssignments, setOfficer } from "@/server/domain/org/officerService";

// Feature 055 (P7-R12): the officer-designation admin API. Default-deny — `content.write` (webmaster =
// public-content curator). The service enforces board-seat membership + audits.
export const GET = withAuth({ requires: "content.write" }, async () => {
  return NextResponse.json({
    roles: BOARD_ROLES.map((r) => ({ key: r.key, roleName: r.roleName, emailAlias: r.emailAlias })),
    assignments: await listOfficerAssignments(db),
  });
});

export const POST = withAuth({ requires: "content.write" }, async (req, ctx) => {
  const input = await parseBody(req, officerSetSchema);
  await setOfficer(db, input.roleKey, input.contactId, ctx.staff.contactId);
  return NextResponse.json({ ok: true });
});
