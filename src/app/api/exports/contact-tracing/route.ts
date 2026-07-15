import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { errors } from "@/server/lib/apiError";
import { eventIdSchema } from "@/server/validation/exports";
import { buildContactTracingRows } from "@/server/domain/exports/contactTracingService";
import { recordExportRun } from "@/server/domain/exports/exportAuditService";
import { rowsToCsv } from "@/server/domain/exports/csv";

export const GET = withAuth(async (req) => {
  const url = new URL(req.url);
  const parsed = eventIdSchema.safeParse(url.searchParams.get("eventId"));
  if (!parsed.success) throw errors.eventNotFound();

  const { count, rows } = await buildContactTracingRows(db, parsed.data);
  if (count === 0) {
    return NextResponse.json({ count: 0 });
  }

  const csv = rowsToCsv(["email", "first_name", "last_name", "date"], rows);
  const eventDate = rows[0]?.date ?? "unknown-date";
  await recordExportRun(db, {
    listId: "contact_tracing",
    eventId: parsed.data,
    rowCount: rows.length,
    actor: null,
  });

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="contact_tracing_${eventDate}.csv"`,
    },
  });
});
