import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { accountLevelSchema } from "@/server/validation/memberships";
import { changeLevel } from "@/server/domain/membership/accountService";
import { getContact } from "@/server/domain/contacts/contactService";
import { canReadPii, projectContact, recordPiiDisclosure } from "@/server/auth/pii";

/**
 * Feature 068 (FR-023): change an account's level from the payer's record.
 *
 * A reduction that would displace existing members is refused and NAMES them (FR-003a) — the FS needs to
 * know who to remove first, not merely that someone would be.
 */
export const PATCH = withAuth<{ id: string }>(
  { requires: "membership.write" },
  async (req, ctx) => {
    const { id } = await ctx.params;
    const { level } = await parseBody(req, accountLevelSchema);
    await changeLevel(db, id, level, ctx.staff.contactId);

    const contact = await getContact(db, id);
    if (canReadPii(ctx.actor)) {
      await recordPiiDisclosure(db, ctx.actor, "contacts.membership", 1);
      return NextResponse.json(contact);
    }
    return NextResponse.json(projectContact(ctx.actor, contact));
  },
);
