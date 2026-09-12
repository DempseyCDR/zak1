import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { errors } from "@/server/lib/apiError";
import { listMergesForContact } from "@/server/domain/dedup/mergeHistoryService";

/**
 * Feature 074 (FR-026 to FR-028). The merges that produced a contact.
 *
 * `merge_audit` has been written since feature 033 and read by nothing — there was no merge history
 * surface at all, because there was nothing useful to do with one. An undo nobody can find is not an
 * undo, so this is the route that makes it reachable.
 *
 * Each entry carries its own reversibility verdict, and only `reversible` may be offered as an action:
 * a merge recorded before this feature has no manifest and must say so rather than presenting a button
 * that would fail.
 */
export const GET = withAuth({ requires: "dedup.write" }, async (req) => {
  const contactId = new URL(req.url).searchParams.get("contactId");
  if (!contactId) throw errors.contactNotFound();

  const merges = await listMergesForContact(db, contactId);
  return NextResponse.json({ merges });
});
