import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { membershipCreateSchema } from "@/server/validation/memberships";
import { recordDuesPayment } from "@/server/domain/membership/accountService";

/**
 * Feature 068: record dues against the payer's ACCOUNT.
 *
 * Retained as the API-level entry point (the record-level path is
 * `POST /api/contacts/{id}/membership/payment`). `contactId` is the PAYER; the account is opened or
 * renewed and the payer is attached automatically.
 */
export const POST = withAuth({ requires: "membership.write" }, async (req, ctx) => {
  const input = await parseBody(req, membershipCreateSchema);
  const account = await recordDuesPayment(
    db,
    input.contactId,
    { level: input.level, paymentDate: input.paymentDate },
    ctx.staff.contactId,
  );
  return NextResponse.json(account, { status: 201 });
});
