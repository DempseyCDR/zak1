import { desc } from "drizzle-orm";
import type { Db, DbOrTx } from "@/server/db/client";
import { mailingListExports } from "@/server/db/schema";
import type { MailingListId } from "@/server/db/schema";
import { writeAudit } from "@/server/lib/audit";

export async function recordExportRun(
  db: DbOrTx,
  input: { listId: MailingListId; eventId?: string; rowCount: number; actor: string | null },
): Promise<void> {
  await db.insert(mailingListExports).values({
    listId: input.listId,
    eventId: input.eventId ?? null,
    rowCount: input.rowCount,
    actor: input.actor,
  });
  writeAudit({
    kind: "mailing_list.exported",
    actor: input.actor,
    details: { listId: input.listId, eventId: input.eventId ?? null, rowCount: input.rowCount },
  });
}

export type LastExport = { actor: string | null; rowCount: number; createdAt: string };

/** Latest export per list_id (most recent row wins), keyed by list_id. */
export async function getLastExports(db: Db): Promise<Partial<Record<MailingListId, LastExport>>> {
  const rows = await db
    .select({
      listId: mailingListExports.listId,
      actor: mailingListExports.actor,
      rowCount: mailingListExports.rowCount,
      createdAt: mailingListExports.createdAt,
    })
    .from(mailingListExports)
    .orderBy(desc(mailingListExports.createdAt));

  const result: Partial<Record<MailingListId, LastExport>> = {};
  for (const row of rows) {
    if (!result[row.listId]) {
      result[row.listId] = {
        actor: row.actor,
        rowCount: row.rowCount,
        createdAt: row.createdAt.toISOString(),
      };
    }
  }
  return result;
}
