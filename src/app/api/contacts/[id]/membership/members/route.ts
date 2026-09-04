import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { accountMemberSchema } from "@/server/validation/memberships";
import { attachMember, detachMember } from "@/server/domain/membership/accountService";
import { getContact } from "@/server/domain/contacts/contactService";
import { canReadPii, projectContact, recordPiiDisclosure } from "@/server/auth/pii";
import type { Actor } from "@/server/auth/actor";

/**
 * Feature 068 (FR-008/FR-022): maintain the household from the payer's record. `{id}` is the PAYER; the
 * body names the contact being covered.
 */
async function respond(actor: Actor | undefined, id: string) {
  const contact = await getContact(db, id);
  if (actor && canReadPii(actor)) {
    await recordPiiDisclosure(db, actor, "contacts.membership", 1);
    return NextResponse.json(contact);
  }
  return NextResponse.json(projectContact(actor, contact));
}

export const POST = withAuth<{ id: string }>(
  { requires: "membership.write" },
  async (req, ctx) => {
    const { id } = await ctx.params;
    const { contactId } = await parseBody(req, accountMemberSchema);
    await attachMember(db, id, contactId, ctx.staff.contactId);
    return respond(ctx.actor, id);
  },
);

export const DELETE = withAuth<{ id: string }>(
  { requires: "membership.write" },
  async (req, ctx) => {
    const { id } = await ctx.params;
    const { contactId } = await parseBody(req, accountMemberSchema);
    await detachMember(db, id, contactId, ctx.staff.contactId);
    return respond(ctx.actor, id);
  },
);
