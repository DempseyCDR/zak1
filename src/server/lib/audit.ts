import { logger } from "@/server/lib/logger";

/**
 * Append-only audit writer (Constitution Principle IV). Used for merges and
 * membership-status changes (features US2/US3). For the MVP the audit sink is
 * the structured log; dedicated audit tables are introduced with those stories.
 */
export type AuditEvent = {
  kind:
    | "contact.merge"
    | "membership.status_change"
    | "contact.created"
    | "email.created"
    | "door_record.created"
    | "door_record.updated"
    | "attendance.purge"
    | "booking.created"
    | "booking.updated"
    | "booking.deleted"
    | "rate_parameter.created"
    | "treasurer_report.generated"
    | "qbo_mapping.updated"
    | "expense_parameter.created"
    | "mailing_list.exported"
    | "band.created"
    | "band.updated"
    | "band.deleted"
    | "band.booked"
    | "venue.created"
    | "venue.updated"
    | "venue_rent.created"
    | "event.rent_set";
  actor: string | null;
  details: Record<string, unknown>;
};

export function writeAudit(event: AuditEvent): void {
  logger.info({ audit: true, ...event }, `audit:${event.kind}`);
}
