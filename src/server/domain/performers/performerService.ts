import { and, eq, gte, lte, sql } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { bookings, events, performers } from "@/server/db/schema";
import type { PerformerRow } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { centsToDollars } from "@/server/lib/money";
import type { PerformerCreateInput, PerformerPatchInput } from "@/server/validation/performers";

export async function createPerformer(
  db: Db,
  input: PerformerCreateInput,
): Promise<PerformerRow> {
  const [row] = await db
    .insert(performers)
    .values({
      displayName: input.displayName,
      contactId: input.contactId ?? null,
      bio: input.bio ?? null,
      photoUrl: input.photoUrl ?? null,
    })
    .returning();
  if (!row) throw new Error("performer insert failed");
  return row;
}

export async function listPerformers(db: Db): Promise<PerformerRow[]> {
  return db.select().from(performers);
}

export type PerformerDetail = PerformerRow & {
  appearanceCount: number;
  ytdEarnings: number; // dollars; excludes donated and $0
};

/** Appearance history = all bookings; YTD earnings = paid, non-donated bookings this calendar year. */
export async function getPerformer(db: Db, id: string): Promise<PerformerDetail> {
  const performer = await db.query.performers.findFirst({ where: eq(performers.id, id) });
  if (!performer) throw errors.performerNotFound();

  const [appearances] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookings)
    .where(eq(bookings.performerId, id));

  const year = new Date().getUTCFullYear();
  const [earned] = await db
    .select({ total: sql<number>`coalesce(sum(${bookings.payCents}), 0)::int` })
    .from(bookings)
    .innerJoin(events, eq(events.id, bookings.eventId))
    .where(
      and(
        eq(bookings.performerId, id),
        eq(bookings.isDonated, false),
        gte(events.eventDate, `${year}-01-01`),
        lte(events.eventDate, `${year}-12-31`),
      ),
    );

  return {
    ...performer,
    appearanceCount: appearances?.count ?? 0,
    ytdEarnings: centsToDollars(earned?.total ?? 0),
  };
}

export async function patchPerformer(
  db: Db,
  id: string,
  input: PerformerPatchInput,
): Promise<PerformerRow> {
  const [row] = await db
    .update(performers)
    .set({
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.contactId !== undefined ? { contactId: input.contactId } : {}),
      ...(input.bio !== undefined ? { bio: input.bio } : {}),
      ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl } : {}),
      updatedAt: new Date(),
    })
    .where(eq(performers.id, id))
    .returning();
  if (!row) throw errors.performerNotFound();
  return row;
}
