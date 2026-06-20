import cron from "node-cron";
import { db, sql } from "@/server/db/client";
import { logger } from "@/server/lib/logger";
import { refreshAllStatuses } from "@/server/domain/membership/membershipService";

/**
 * Daily membership-status refresh. Idempotent: only contacts whose status
 * actually changes get an audit row. Run on a schedule, or directly via CLI.
 */
export async function runMembershipRefresh(): Promise<{ scanned: number; changed: number }> {
  const result = await refreshAllStatuses(db);
  logger.info({ job: "membership-refresh", ...result }, "membership refresh complete");
  return result;
}

/** Register the daily refresh on an in-process cron schedule (default 03:15). */
export function registerMembershipRefreshCron(expression = "15 3 * * *"): void {
  cron.schedule(expression, () => {
    void runMembershipRefresh().catch((err) =>
      logger.error({ job: "membership-refresh", err: (err as Error).message }, "refresh failed"),
    );
  });
  logger.info({ job: "membership-refresh", expression }, "membership refresh scheduled");
}

// CLI entrypoint: `node --env-file=.env --import tsx src/jobs/membership-refresh.ts`
if (import.meta.url === `file://${process.argv[1]}`) {
  runMembershipRefresh()
    .then(async (r) => {
      console.log(`membership refresh: scanned=${r.scanned} changed=${r.changed}`);
      await sql.end();
    })
    .catch(async (err) => {
      console.error(err);
      await sql.end();
      process.exit(1);
    });
}
