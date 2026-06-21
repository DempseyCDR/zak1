import { db } from "./db";
import { createEvent } from "@/server/domain/events/eventService";
import { createPerformer } from "@/server/domain/performers/performerService";
import type { EventRow, PerformerRow } from "@/server/db/schema";

export async function makeEvent(opts?: {
  seriesKey?: string;
  eventDate?: string;
  chargesAdmission?: boolean;
  groupId?: string;
}): Promise<EventRow> {
  return createEvent(db, {
    seriesKey: opts?.seriesKey ?? "tnc",
    eventDate: opts?.eventDate ?? "2026-06-18",
    chargesAdmission: opts?.chargesAdmission ?? true,
    ...(opts?.groupId ? { groupId: opts.groupId } : {}),
  });
}

export async function makePerformer(displayName = "Test Performer"): Promise<PerformerRow> {
  return createPerformer(db, { displayName });
}
