import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withLogging } from "@/server/lib/withLogging";
import { errors } from "@/server/lib/apiError";
import { listIdSchema } from "@/server/validation/exports";
import { getMailingListDef } from "@/server/domain/exports/mailingLists";
import { buildListRows } from "@/server/domain/exports/exportService";
import { recordExportRun } from "@/server/domain/exports/exportAuditService";
import { rowsToCsv } from "@/server/domain/exports/csv";

const COLUMNS: Record<string, string[]> = {
  member: ["email", "first_name", "last_name", "membership_status", "membership_through_year"],
};
const DEFAULT_COLUMNS = ["email", "first_name", "last_name"];

export const GET = withLogging<{ listId: string }>(async (_req, ctx) => {
  const { listId } = await ctx.params;
  const parsed = listIdSchema.safeParse(listId);
  if (!parsed.success) throw errors.mailingListNotFound();

  const def = getMailingListDef(parsed.data);
  const rows = await buildListRows(db, parsed.data);
  const columns = COLUMNS[parsed.data] ?? DEFAULT_COLUMNS;
  const csv = rowsToCsv(columns, rows);

  await recordExportRun(db, { listId: parsed.data, rowCount: rows.length, actor: null });

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${def.filename}"`,
    },
  });
});
