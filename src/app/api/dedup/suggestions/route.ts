import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { getMergeSuggestions } from "@/server/domain/dedup/suggestionService";

export const GET = withAuth({ requires: "base" }, async (req) => {
  const url = new URL(req.url);
  const thresholdParam = url.searchParams.get("threshold");
  const threshold = thresholdParam ? Number(thresholdParam) : undefined;
  const q = url.searchParams.get("q") ?? undefined;
  const pairs = await getMergeSuggestions(db, threshold, undefined, q);
  return NextResponse.json({ pairs });
});
