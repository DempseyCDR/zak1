import { MEMBERSHIP_LEVELS } from "./loadPlan";
import type { LoadCounts, PerformerResolution } from "./loadPlan";

// Feature 044 — render the audit summary (contract: contact-load-cli.md). Pure; unit-tested (T019).
export function formatSummary(
  counts: LoadCounts,
  resolution: PerformerResolution,
  opts: { committed: boolean; backupPath?: string | null },
): string {
  const levels = MEMBERSHIP_LEVELS.map((l) => `${l} ${counts.membershipsByLevel[l]}`).join(", ");
  const lines = [
    `Contact Load — ${new Date().toISOString()}  [${opts.committed ? "COMMITTED" : "DRY RUN"}]`,
    `  backup:               ${opts.backupPath ?? "(none — dry run)"}`,
    `  contacts retained:    ${counts.retained}   (role-grant holders + merge parties)`,
    `  contacts removed:     ${counts.removed}`,
    `  contacts created:     ${counts.contactsCreated}   (updated in place: ${counts.contactsUpdated}; needs_review: ${counts.needsReview})`,
    `  emails created:       ${counts.emailsCreated}`,
    `  memberships created:  ${counts.membershipsCreated}   (${levels})`,
    `  volunteers set:       ${counts.volunteersSet}`,
    `  performer links:      auto ${counts.performerAuto}, ambiguous ${counts.performerAmbiguous}, unmatched ${counts.performerUnmatched}`,
  ];
  if (resolution.ambiguous.length > 0) {
    lines.push(
      `  ambiguous performers: ${resolution.ambiguous.map((a) => a.displayName).join(", ")}`,
    );
  }
  if (resolution.unmatched.length > 0) {
    lines.push(
      `  unmatched performers: ${resolution.unmatched.map((u) => u.displayName).join(", ")}`,
    );
  }
  return lines.join("\n");
}
