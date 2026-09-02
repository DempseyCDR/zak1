import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { contactPatchSchema } from "@/server/validation/contacts";
import { getContact, patchContact } from "@/server/domain/contacts/contactService";
import { canReadPii, projectContact, recordPiiDisclosure } from "@/server/auth/pii";
import { actorCan } from "@/server/auth/can";

export const GET = withAuth<{ id: string }>({ requires: "base" }, async (_req, ctx) => {
  const { id } = await ctx.params;
  const contact = await getContact(db, id);
  // `base` lets any volunteer look a contact up (FR-015); PII is still gated per FR-016. A holder sees
  // it — and the disclosure is audited (FR-017b); the base sees a name with the PII fields emptied.
  if (canReadPii(ctx.actor)) {
    await recordPiiDisclosure(db, ctx.actor, "contacts.get", 1);
    return NextResponse.json(contact);
  }
  return NextResponse.json(projectContact(ctx.actor, contact));
});

export const PATCH = withAuth<{ id: string }>({ requires: "contact.write" }, async (req, ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, contactPatchSchema);
  // `is_volunteer` is the staff-access gate (feature 015). Only a `role.assign` holder may change it;
  // for anyone else silently drop the field so the rest of the save still applies (feature 063 / M-R7).
  if (input.isVolunteer !== undefined && !actorCan(ctx.actor, "role.assign")) {
    delete input.isVolunteer;
  }
  const contact = await patchContact(db, id, input);
  return NextResponse.json(contact);
});
