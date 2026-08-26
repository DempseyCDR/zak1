import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { desc, eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { announcements, auditEvents } from "@/server/db/schema";
import {
  clearAnnouncement,
  getActiveAnnouncement,
  getCurrentForAdmin,
  postAnnouncement,
} from "@/server/domain/announcements/announcementService";

// Feature 056 (P7-R13, real Postgres): post/get/clear/supersede semantics + auto-expiry (derived on read) +
// the audit trail. The public projection must carry only display-safe fields.

describe("announcementService", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("posts and returns the display projection (no internal columns)", async () => {
    await postAnnouncement(
      db,
      { text: "Tonight is CANCELLED", level: "urgent", durationHours: 24, link: null },
      null,
    );
    const active = await getActiveAnnouncement(db);
    expect(active).not.toBeNull();
    expect(active).toEqual({
      id: expect.any(String),
      text: "Tonight is CANCELLED",
      level: "urgent",
      link: null,
    });
    // The projection carries ONLY display-safe keys.
    expect(Object.keys(active!).sort()).toEqual(["id", "level", "link", "text"]);
  });

  it("carries a link when both label and url are set", async () => {
    await postAnnouncement(
      db,
      {
        text: "Weather",
        level: "info",
        durationHours: 24,
        link: { label: "Details", url: "https://cdrochester.org/weather" },
      },
      null,
    );
    const active = await getActiveAnnouncement(db);
    expect(active!.link).toEqual({ label: "Details", url: "https://cdrochester.org/weather" });
  });

  it("supersedes: a second post wins (latest by posted_at)", async () => {
    await postAnnouncement(
      db,
      { text: "First", level: "info", durationHours: 24, link: null },
      null,
    );
    await postAnnouncement(
      db,
      { text: "Second", level: "info", durationHours: 24, link: null },
      null,
    );
    const active = await getActiveAnnouncement(db);
    expect(active!.text).toBe("Second");
  });

  it("clearAnnouncement makes the current notice inactive (null)", async () => {
    await postAnnouncement(
      db,
      { text: "Notice", level: "info", durationHours: 24, link: null },
      null,
    );
    await clearAnnouncement(db, null);
    expect(await getActiveAnnouncement(db)).toBeNull();
    // getCurrentForAdmin still returns the row (history retained), now cleared.
    const current = await getCurrentForAdmin(db);
    expect(current).not.toBeNull();
    expect(current!.clearedAt).not.toBeNull();
  });

  it("a row past its duration resolves to null (auto-expiry, no write)", async () => {
    await postAnnouncement(db, { text: "Old", level: "info", durationHours: 24, link: null }, null);
    // Back-date posted_at to 25h ago so the 24h window has elapsed.
    const [row] = await db
      .select()
      .from(announcements)
      .orderBy(desc(announcements.postedAt))
      .limit(1);
    await db
      .update(announcements)
      .set({ postedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) })
      .where(eq(announcements.id, row!.id));
    expect(await getActiveAnnouncement(db)).toBeNull();
  });

  it("clearAnnouncement is a no-op when there is nothing to clear", async () => {
    await expect(clearAnnouncement(db, null)).resolves.toBeUndefined();
  });

  it("writes an audit_events row per post and per clear", async () => {
    await postAnnouncement(db, { text: "A", level: "info", durationHours: 24, link: null }, null);
    await clearAnnouncement(db, null);
    const posted = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.kind, "announcement.posted"));
    const cleared = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.kind, "announcement.cleared"));
    expect(posted).toHaveLength(1);
    expect(cleared).toHaveLength(1);
  });
});
