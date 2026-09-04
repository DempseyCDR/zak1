import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { messageRecipientSchema } from "@/server/validation/contacts";
import { getContact } from "@/server/domain/contacts/contactService";
import {
  linkMessageRecipient,
  unlinkMessageRecipient,
} from "@/server/domain/contacts/referenceService";
import type { Actor } from "@/server/auth/actor";
import { canReadPii, projectContact, recordPiiDisclosure } from "@/server/auth/pii";

/**
 * Feature 067 (M-R23): the shared / family email reference.
 *
 * Gated by `contact.mailing.write` — the reference decides where a person's mail is delivered, which is
 * the mailing-write concern, not a deduplication decision (merge stays on `dedup.write`). Already global
 * for `mailing_list_manager` since feature 059, so this feature adds NO capability.
 */
async function respond(actor: Actor | undefined, id: string) {
  const contact = await getContact(db, id);
  // The response carries the resolved address, so it is a PII disclosure like any other contact read.
  if (actor && canReadPii(actor)) {
    await recordPiiDisclosure(db, actor, "contacts.message-recipient", 1);
    return NextResponse.json(contact);
  }
  return NextResponse.json(projectContact(actor, contact));
}

export const PUT = withAuth<{ id: string }>(
  { requires: "contact.mailing.write" },
  async (req, ctx) => {
    const { id } = await ctx.params;
    const input = await parseBody(req, messageRecipientSchema);
    await linkMessageRecipient(db, id, input, ctx.staff.contactId);
    return respond(ctx.actor, id);
  },
);

export const DELETE = withAuth<{ id: string }>(
  { requires: "contact.mailing.write" },
  async (_req, ctx) => {
    const { id } = await ctx.params;
    await unlinkMessageRecipient(db, id, ctx.staff.contactId);
    return respond(ctx.actor, id);
  },
);
