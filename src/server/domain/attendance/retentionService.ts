import { sql } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { attendance, events, quarterlyAttendanceCounts } from "@/server/db/schema";
import { writeAudit } from "@/server/lib/audit";

const RETENTION_DAYS = 90;

/**
 * Roll up >90-day attendance into permanent quarterly counts, then delete those
 * rows — in one transaction. Idempotent: only still-present, >90-day rows are
 * counted, and they are deleted in the same transaction, so a re-run is a no-op.
 */
export async function purgeOldAttendance(
  db: Db,
): Promise<{ rolledUp: number; purged: number }> {
  return db.transaction(async (tx) => {
    const cutoff = sql`now() - interval '${sql.raw(String(RETENTION_DAYS))} days'`;

    // Aggregate purge-eligible attendance by series / year / quarter of the event date.
    const groups = await tx
      .select({
        seriesId: events.seriesId,
        year: sql<number>`extract(year from ${events.eventDate})::int`,
        quarter: sql<number>`extract(quarter from ${events.eventDate})::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(attendance)
      .innerJoin(events, sql`${events.id} = ${attendance.eventId}`)
      .where(sql`${attendance.createdAt} < ${cutoff}`)
      .groupBy(events.seriesId, sql`extract(year from ${events.eventDate})`, sql`extract(quarter from ${events.eventDate})`);

    let rolledUp = 0;
    for (const g of groups) {
      rolledUp += g.count;
      await tx
        .insert(quarterlyAttendanceCounts)
        .values({
          seriesId: g.seriesId,
          year: g.year,
          quarter: g.quarter,
          attendeeCount: g.count,
        })
        .onConflictDoUpdate({
          target: [
            quarterlyAttendanceCounts.seriesId,
            quarterlyAttendanceCounts.year,
            quarterlyAttendanceCounts.quarter,
          ],
          set: {
            attendeeCount: sql`${quarterlyAttendanceCounts.attendeeCount} + ${g.count}`,
          },
        });
    }

    const deleted = await tx
      .delete(attendance)
      .where(sql`${attendance.createdAt} < ${cutoff}`)
      .returning({ id: attendance.id });

    writeAudit({
      kind: "attendance.purge",
      actor: null,
      details: { rolledUp, purged: deleted.length },
    });
    return { rolledUp, purged: deleted.length };
  });
}
