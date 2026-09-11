import { loadEnv } from "@/server/lib/loadEnv";
import { db } from "@/server/db/client";
import { repairStrandedMerges } from "@/server/domain/dedup/repairStrandedMerges";

/**
 * Feature 072 (FR-015): one-off repair of records earlier merges left on a retired contact.
 *
 * ⚠️ SPENT AFTER RUNNING. This exists because fixing the merge does not move rows it failed to move
 * before; once every database has been repaired it has no purpose and should be deleted, along with
 * `repairStrandedMerges.ts` and its test — exactly as feature 070 removed `migrateToAccounts` once its
 * work was done. Leaving it in place invites someone to run it on data it was never reasoned about.
 *
 * Idempotent, so a second run is harmless: it reports zeros.
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  loadEnv();
  repairStrandedMerges(db)
    .then((report) => {
      const total = Object.values(report).reduce((a, b) => a + b, 0);
      console.log(total === 0 ? "nothing stranded — no changes" : "repaired:", report);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
