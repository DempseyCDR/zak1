import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { countNeedsReview } from "@/server/domain/contacts/contactService";
import { countMergeSuggestions } from "@/server/domain/dedup/suggestionService";

// Feature 064: the two totals for the contacts-launcher task buttons — needs-review contacts and
// candidate duplicate pairs. Read-only; any signed-in staff may see the counts (the lists are gated as
// before). Fetched on load so the launcher shows work-waiting without loading any list.
export const GET = withAuth({ requires: "base" }, async () => {
  const [needsReview, duplicates] = await Promise.all([
    countNeedsReview(db),
    countMergeSuggestions(db),
  ]);
  return NextResponse.json({ needsReview, duplicates });
});
