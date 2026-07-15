import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { MAILING_LISTS } from "@/server/domain/exports/mailingLists";
import { getLastExports } from "@/server/domain/exports/exportAuditService";

export const GET = withAuth(async () => {
  const lastExports = await getLastExports(db);

  const items = MAILING_LISTS.map((def) => ({
    listId: def.id,
    filename: def.filename,
    kind: def.kind,
    lastExport: lastExports[def.id] ?? null,
  }));

  return NextResponse.json({ items });
});
