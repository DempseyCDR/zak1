import { eq } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { mappingAudit, series, seriesQboMap } from "@/server/db/schema";
import type { SeriesQboMapRow } from "@/server/db/schema";
import { errors } from "@/server/lib/apiError";
import { writeAudit } from "@/server/lib/audit";
import type { SeriesQboPutInput } from "@/server/validation/treasurer";

export async function loadSeriesQbo(db: Db, seriesId: string): Promise<SeriesQboMapRow | null> {
  const row = await db.query.seriesQboMap.findFirst({ where: eq(seriesQboMap.seriesId, seriesId) });
  return row ?? null;
}

export async function getMappingConfig(db: Db): Promise<{
  series: (SeriesQboMapRow & { seriesKey: string })[];
}> {
  const rows = await db
    .select({
      seriesId: seriesQboMap.seriesId,
      gateCustomer: seriesQboMap.gateCustomer,
      qboClass: seriesQboMap.qboClass,
      updatedAt: seriesQboMap.updatedAt,
      seriesKey: series.key,
    })
    .from(seriesQboMap)
    .innerJoin(series, eq(series.id, seriesQboMap.seriesId));
  return { series: rows };
}

export async function updateSeriesQbo(
  db: Db,
  seriesId: string,
  input: SeriesQboPutInput,
  actor: string | null = null,
): Promise<SeriesQboMapRow> {
  const exists = await db.query.series.findFirst({ where: eq(series.id, seriesId) });
  if (!exists) throw errors.seriesNotFound();
  const [row] = await db
    .insert(seriesQboMap)
    .values({ seriesId, gateCustomer: input.gateCustomer, qboClass: input.qboClass })
    .onConflictDoUpdate({
      target: seriesQboMap.seriesId,
      set: { gateCustomer: input.gateCustomer, qboClass: input.qboClass, updatedAt: new Date() },
    })
    .returning();
  if (!row) throw new Error("series qbo upsert failed");
  await db
    .insert(mappingAudit)
    .values({ mappingKind: "series_qbo", key: seriesId, details: input, actor });
  writeAudit({ kind: "qbo_mapping.updated", actor, details: { kind: "series_qbo", seriesId } });
  return row;
}
