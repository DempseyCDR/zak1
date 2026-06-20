import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withLogging } from "@/server/lib/withLogging";
import { getMergeSuggestions } from "@/server/domain/dedup/suggestionService";

export const GET = withLogging(async (req) => {
  const url = new URL(req.url);
  const thresholdParam = url.searchParams.get("threshold");
  const threshold = thresholdParam ? Number(thresholdParam) : undefined;
  const pairs = await getMergeSuggestions(db, threshold);
  return NextResponse.json({ pairs });
});
