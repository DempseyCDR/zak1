import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { membershipPaymentSchema } from "@/server/validation/memberships";
import { recordDuesPayment } from "@/server/domain/membership/accountService";
import { getContact } from "@/server/domain/contacts/contactService";
import { canReadPii, projectContact, recordPiiDisclosure } from "@/server/auth/pii";

/**
 * Feature 068 (FR-006): record a dues payment against a payer's account.
 *
 * This is the out-of-door path — a cheque received in the post. It records **membership only**: the club
 * has no non-event income capability (deliberately removed in feature 038) and this feature does not
 * restore one, so the money is reconciled outside the system. Gate-reported dues continue to record money
 * exactly as they always have.
 *
 * `membership.write` — Financial Secretary, Treasurer, Super-user (FR-017). No new capability.
 */
export const POST = withAuth<{ id: string }>(
  { requires: "membership.write" },
  async (req, ctx) => {
    const { id } = await ctx.params;
    const input = await parseBody(req, membershipPaymentSchema);
    await recordDuesPayment(db, id, input, ctx.staff.contactId);

    const contact = await getContact(db, id);
    if (canReadPii(ctx.actor)) {
      await recordPiiDisclosure(db, ctx.actor, "contacts.membership", 1);
      return NextResponse.json(contact);
    }
    return NextResponse.json(projectContact(ctx.actor, contact));
  },
);
