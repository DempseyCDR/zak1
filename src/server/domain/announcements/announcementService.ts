import { desc, eq } from "drizzle-orm";
import type { Db, DbOrTx } from "@/server/db/client";
import { announcements, type AnnouncementRow } from "@/server/db/schema";
import { recordAudit } from "@/server/lib/audit";
import type { AnnouncementPostInput } from "@/server/validation/announcement";

// Feature 056 (P7-R13): the site-wide announcement banner. One record model — each post inserts a row, the
// latest by posted_at is the CURRENT notice, and posting supersedes. "Active" is DERIVED ON READ via the pure
// isAnnouncementActive (cleared_at IS NULL AND now < posted_at + duration_hours) — no scheduler; the boundary
// is unit-testable off-DB. The PUBLIC projection carries only display-safe fields (never posted_at / duration /
// cleared) — the gate lives in the type. Independent of event status (feature 018).

export type AnnouncementLevel = "info" | "urgent";

export type PublicAnnouncement = {
  id: string;
  text: string;
  level: AnnouncementLevel;
  link: { label: string; url: string } | null;
};

const MS_PER_HOUR = 60 * 60 * 1000;

/** Pure: active iff not cleared AND now is before posted_at + duration_hours. (Unit-tested at the boundary.) */
export function isAnnouncementActive(
  row: Pick<AnnouncementRow, "postedAt" | "durationHours" | "clearedAt">,
  now: Date,
): boolean {
  if (row.clearedAt !== null) return false;
  const expiresAt = row.postedAt.getTime() + row.durationHours * MS_PER_HOUR;
  return now.getTime() < expiresAt;
}

/** `level` is stored as free text; narrow it to the known set (unknown → "info"). */
function toLevel(raw: string): AnnouncementLevel {
  return raw === "urgent" ? "urgent" : "info";
}

/** The latest row (the current notice), active or not — one indexed ORDER BY posted_at DESC LIMIT 1. */
async function getCurrent(db: DbOrTx): Promise<AnnouncementRow | null> {
  const [row] = await db
    .select()
    .from(announcements)
    .orderBy(desc(announcements.postedAt))
    .limit(1);
  return row ?? null;
}

/** Map a row to the display-safe public projection (drops internal columns). */
function toPublic(row: AnnouncementRow): PublicAnnouncement {
  return {
    id: row.id,
    text: row.text,
    level: toLevel(row.level),
    link: row.linkLabel && row.linkUrl ? { label: row.linkLabel, url: row.linkUrl } : null,
  };
}

/** The current active announcement (latest row if active), as a display-safe projection; else null. */
export async function getActiveAnnouncement(db: DbOrTx): Promise<PublicAnnouncement | null> {
  const row = await getCurrent(db);
  if (!row || !isAnnouncementActive(row, new Date())) return null;
  return toPublic(row);
}

/** The current row (active or not) for the admin editor — includes duration/level/link for prefill. */
export async function getCurrentForAdmin(db: Db): Promise<AnnouncementRow | null> {
  return getCurrent(db);
}

/** Post a new current announcement (supersedes; the active window starts now). Audited. */
export async function postAnnouncement(
  db: Db,
  input: AnnouncementPostInput,
  actorContactId: string | null,
): Promise<void> {
  const [row] = await db
    .insert(announcements)
    .values({
      text: input.text,
      level: input.level,
      durationHours: input.durationHours,
      linkLabel: input.link?.label ?? null,
      linkUrl: input.link?.url ?? null,
    })
    .returning({ id: announcements.id });
  await recordAudit(db, {
    kind: "announcement.posted",
    actorContactId,
    details: {
      announcementId: row?.id ?? null,
      level: input.level,
      durationHours: input.durationHours,
    },
  });
}

/** Clear the current announcement early (cleared_at = now on the latest row). Audited. No-op if none. */
export async function clearAnnouncement(db: Db, actorContactId: string | null): Promise<void> {
  const row = await getCurrent(db);
  if (!row) return;
  await db.update(announcements).set({ clearedAt: new Date() }).where(eq(announcements.id, row.id));
  await recordAudit(db, {
    kind: "announcement.cleared",
    actorContactId,
    details: { announcementId: row.id },
  });
}
