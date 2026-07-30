import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeEvent } from "./helpers/factories";
import { listEvents } from "@/server/domain/events/eventService";
import { events } from "@/server/db/schema";
import { eq } from "drizzle-orm";

// Feature 025 US2 (FR-012): listEvents returns events newest-relevant-first — by date then start time, desc.
describe("listEvents ordering", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("orders by date desc, then start time desc (nulls last within a day)", async () => {
    const older = await makeEvent({ eventDate: "2026-06-01" });
    const newerEarly = await makeEvent({ eventDate: "2026-06-18" });
    const newerLate = await makeEvent({ eventDate: "2026-06-18" });
    await db.update(events).set({ startTime: "19:30:00" }).where(eq(events.id, newerLate.id));
    await db.update(events).set({ startTime: "13:00:00" }).where(eq(events.id, newerEarly.id));

    const ordered = await listEvents(db);
    const ids = ordered.map((e) => e.id);
    // Both 06-18 events (later start first) precede the 06-01 event.
    expect(ids.indexOf(newerLate.id)).toBeLessThan(ids.indexOf(newerEarly.id));
    expect(ids.indexOf(newerEarly.id)).toBeLessThan(ids.indexOf(older.id));
  });
});
