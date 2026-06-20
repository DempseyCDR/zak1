import cron from "node-cron";
import { db, sql } from "@/server/db/client";
import { logger } from "@/server/lib/logger";
import { purgeOldAttendance } from "@/server/domain/attendance/retentionService";

/** Daily 90-day attendance purge with quarterly roll-up. Idempotent. */
export async function runAttendancePurge(): Promise<{ rolledUp: number; purged: number }> {
  const result = await purgeOldAttendance(db);
  logger.info({ job: "attendance-purge", ...result }, "attendance purge complete");
  return result;
}

/** Register the daily purge on an in-process cron schedule (default 03:30). */
export function registerAttendancePurgeCron(expression = "30 3 * * *"): void {
  cron.schedule(expression, () => {
    void runAttendancePurge().catch((err) =>
      logger.error({ job: "attendance-purge", err: (err as Error).message }, "purge failed"),
    );
  });
  logger.info({ job: "attendance-purge", expression }, "attendance purge scheduled");
}

// CLI: `node --env-file=.env --import tsx src/jobs/attendance-purge.ts`
if (import.meta.url === `file://${process.argv[1]}`) {
  runAttendancePurge()
    .then(async (r) => {
      console.log(`attendance purge: rolledUp=${r.rolledUp} purged=${r.purged}`);
      await sql.end();
    })
    .catch(async (err) => {
      console.error(err);
      await sql.end();
      process.exit(1);
    });
}
