import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { canReadPii, recordPiiDisclosure } from "@/server/auth/pii";
import {
  countSuppressedPairs,
  getMergeSuggestions,
  projectSuggestion,
} from "@/server/domain/dedup/suggestionService";

/**
 * How many pairs the queue will render. Feature 069: this used to be the service's default of 50, applied
 * silently — while the launcher badge counted every pair with no limit, so the button promised a number
 * the list could not show. Worse, revealing rejected pairs pushed the extra rows into the same 50 slots,
 * so "show rejected" could drop a pair OFF the list, which is the opposite of what that control is for.
 * The cap is now generous enough to cover the club's whole queue, and whatever it does cut is REPORTED.
 */
const SUGGESTION_LIMIT = 200;

export const GET = withAuth({ requires: "base" }, async (req, ctx) => {
  const url = new URL(req.url);
  const thresholdParam = url.searchParams.get("threshold");
  const threshold = thresholdParam ? Number(thresholdParam) : undefined;
  const limitParam = Number(url.searchParams.get("limit"));
  const limit = Number.isInteger(limitParam) && limitParam > 0 ? limitParam : SUGGESTION_LIMIT;
  const q = url.searchParams.get("q") ?? undefined;
  // Feature 069 (FR-004a): reveal the pairs a rejection is currently suppressing, so a mistaken
  // "not duplicates" is findable from the queue where its absence would be noticed.
  const includeRejected = url.searchParams.get("includeRejected") === "1";

  // Fetch one past the limit to detect truncation, then slice back — the idiom `listNeedsReview` and
  // `searchContacts` already use, so every list in the app reports a shortened result the same way.
  const found = await getMergeSuggestions(db, threshold, limit + 1, q, { includeRejected });
  const truncated = found.length > limit;

  // Each candidate carries a phone and addresses (feature 033) — PII, on a route every volunteer may
  // call. Feature 069 adds the household address a contact rides (067), whose whole point is that it
  // belongs to somebody else, so projecting here is no longer optional. A denied reader gets the names
  // and is told the row is not resolvable in place, which is true: it is hiding the deciding facts.
  const disclosing = canReadPii(ctx.actor);
  const pairs = (truncated ? found.slice(0, limit) : found).map((p) =>
    projectSuggestion(p, disclosing),
  );
  if (disclosing) await recordPiiDisclosure(db, ctx.actor, "dedup.suggestions", pairs.length * 2);

  // How many this list is hiding, so the queue can SAY so (FR-004a) rather than silently omitting them —
  // including when every matching pair is rejected and the list would otherwise render as simply empty.
  const suppressed = await countSuppressedPairs(db, threshold, q);

  return NextResponse.json({ pairs, truncated, suppressed });
});
