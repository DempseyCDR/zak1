import { logger } from "@/server/lib/logger";

/**
 * Append-only audit writer (Constitution Principle IV). Used for merges and
 * membership-status changes (features US2/US3). For the MVP the audit sink is
 * the structured log; dedicated audit tables are introduced with those stories.
 */
export type AuditEvent = {
  kind: "contact.merge" | "membership.status_change" | "contact.created" | "email.created";
  actor: string | null;
  details: Record<string, unknown>;
};

export function writeAudit(event: AuditEvent): void {
  logger.info({ audit: true, ...event }, `audit:${event.kind}`);
}
