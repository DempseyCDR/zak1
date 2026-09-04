import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { errors } from "@/server/lib/apiError";
import { listIdSchema } from "@/server/validation/exports";
import { getMailingListDef } from "@/server/domain/exports/mailingLists";
import { buildListRows } from "@/server/domain/exports/exportService";
import { recordExportRun } from "@/server/domain/exports/exportAuditService";
import { rowsToCsv } from "@/server/domain/exports/csv";

const COLUMNS: Record<string, string[]> = {
  // Feature 068 (FR-013): `membership_level` is the PAYER'S level, for segmenting a send by what the
  // household bought. `rowsToCsv` projects ONLY these keys, so a value added in exportService never
  // reaches the file unless it is named here too.
  member: [
    "email",
    "first_name",
    "last_name",
    "membership_status",
    "membership_through_year",
    "membership_level",
  ],
};
const DEFAULT_COLUMNS = ["email", "first_name", "last_name"];

export const GET = withAuth<{ listId: string }>({ requires: "export.read" }, async (_req, ctx) => {
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
