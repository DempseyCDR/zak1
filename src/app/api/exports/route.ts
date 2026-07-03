import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withLogging } from "@/server/lib/withLogging";
import { MAILING_LISTS } from "@/server/domain/exports/mailingLists";
import { getMostRecentJabYear } from "@/server/domain/exports/exportService";
import { getLastExports } from "@/server/domain/exports/exportAuditService";

export const GET = withLogging(async () => {
  const [lastExports, jabYear] = await Promise.all([getLastExports(db), getMostRecentJabYear(db)]);

  const items = MAILING_LISTS.map((def) => ({
    listId: def.id,
    filename: def.filename,
    kind: def.kind,
    note: def.id === "janeaustenball" && jabYear !== null ? `Most recent JAB: ${jabYear}` : null,
    lastExport: lastExports[def.id] ?? null,
  }));

  return NextResponse.json({ items });
});
