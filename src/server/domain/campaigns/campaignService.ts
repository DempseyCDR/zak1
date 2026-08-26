import { and, asc, eq, gte, lte } from "drizzle-orm";
import type { Db, DbOrTx } from "@/server/db/client";
import { campaigns, type CampaignRow } from "@/server/db/schema";
import { recordAudit } from "@/server/lib/audit";
import type { CampaignInput } from "@/server/validation/campaign";

// Feature 057 (P7-R14): the home-page promotional campaign slot. Campaigns form a QUEUE — each is a row; the
// home page shows exactly ONE. "Active" and the "which one shows" selection are DERIVED ON READ (no scheduler):
// among rows whose window includes today, the one that EXPIRES FIRST (min end_date; ties: min start_date, then
// created_at). The pure isCampaignActive + selectShownCampaign are the SC-009 source of truth, unit-testable
// off-DB. The PUBLIC projection carries only display-safe fields — no dates/created columns reach the client.
// Independent of event status (018) and the R13 announcement banner.

export type PublicCampaign = {
  id: string;
  heading: string;
  blurb: string;
  image: { url: string; alt: string } | null;
  cta: { label: string; url: string };
};

export type CampaignStatus = "upcoming" | "active" | "ended";

/** The app's standard "today" — a UTC date string (YYYY-MM-DD), the same convention publicSchedule uses to
 *  decide whether an event is upcoming/past, so a campaign and a same-day event flip together. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Pure: active iff start_date <= today <= end_date (inclusive; ISO YYYY-MM-DD, lexicographic compare). */
export function isCampaignActive(
  row: Pick<CampaignRow, "startDate" | "endDate">,
  today: string,
): boolean {
  return row.startDate <= today && today <= row.endDate;
}

/** Pure: of the ACTIVE rows, the one that expires first — order by (endDate, startDate, createdAt); else null.
 *  This is the queue + handoff (SC-009) source of truth. */
export function selectShownCampaign(rows: CampaignRow[], today: string): CampaignRow | null {
  const active = rows.filter((r) => isCampaignActive(r, today));
  if (active.length === 0) return null;
  return active.reduce((best, r) => (comesFirst(r, best) ? r : best));
}

/** Ordering: earliest end_date, then earliest start_date, then earliest created_at. */
function comesFirst(a: CampaignRow, b: CampaignRow): boolean {
  if (a.endDate !== b.endDate) return a.endDate < b.endDate;
  if (a.startDate !== b.startDate) return a.startDate < b.startDate;
  return a.createdAt.getTime() < b.createdAt.getTime();
}

function toPublic(row: CampaignRow): PublicCampaign {
  return {
    id: row.id,
    heading: row.heading,
    blurb: row.blurb,
    image: row.imageUrl && row.imageAlt ? { url: row.imageUrl, alt: row.imageAlt } : null,
    cta: { label: row.ctaLabel, url: row.ctaUrl },
  };
}

/** The campaign the home page shows now — fetch the active rows, apply the pure selector, project; else null. */
export async function getShownCampaign(db: DbOrTx): Promise<PublicCampaign | null> {
  const today = todayISO();
  const active = await db
    .select()
    .from(campaigns)
    .where(and(lte(campaigns.startDate, today), gte(campaigns.endDate, today)))
    .orderBy(asc(campaigns.endDate), asc(campaigns.startDate), asc(campaigns.createdAt));
  const shown = active[0] ?? null; // SQL order matches selectShownCampaign; first is the one that expires first
  return shown ? toPublic(shown) : null;
}

function statusOf(row: CampaignRow, today: string): CampaignStatus {
  if (today < row.startDate) return "upcoming";
  if (today > row.endDate) return "ended";
  return "active";
}

/** Admin read: every campaign + its status + whether it is the one currently shown. */
export async function listCampaigns(
  db: Db,
): Promise<(CampaignRow & { status: CampaignStatus; shown: boolean })[]> {
  const today = todayISO();
  const rows = await db
    .select()
    .from(campaigns)
    .orderBy(asc(campaigns.endDate), asc(campaigns.startDate), asc(campaigns.createdAt));
  const shownId = selectShownCampaign(rows, today)?.id ?? null;
  return rows.map((r) => ({ ...r, status: statusOf(r, today), shown: r.id === shownId }));
}

function rowValues(input: CampaignInput) {
  return {
    heading: input.heading,
    blurb: input.blurb,
    imageUrl: input.image?.url ?? null,
    imageAlt: input.image?.alt ?? null,
    ctaLabel: input.cta.label,
    ctaUrl: input.cta.url,
    startDate: input.startDate,
    endDate: input.endDate,
  };
}

/** Create a campaign (joins the queue; does not affect others). Audited. Returns the new id. */
export async function createCampaign(
  db: Db,
  input: CampaignInput,
  actorContactId: string | null,
): Promise<string> {
  const [row] = await db.insert(campaigns).values(rowValues(input)).returning({ id: campaigns.id });
  const id = row!.id;
  await recordAudit(db, { kind: "campaign.created", actorContactId, details: { campaignId: id } });
  return id;
}

/** Edit a campaign. Audited. Returns false if the id was not found. */
export async function updateCampaign(
  db: Db,
  id: string,
  input: CampaignInput,
  actorContactId: string | null,
): Promise<boolean> {
  const updated = await db
    .update(campaigns)
    .set({ ...rowValues(input), updatedAt: new Date() })
    .where(eq(campaigns.id, id))
    .returning({ id: campaigns.id });
  if (updated.length === 0) return false;
  await recordAudit(db, { kind: "campaign.updated", actorContactId, details: { campaignId: id } });
  return true;
}

/** Remove a campaign (delete). Audited. No-op-safe if already gone. */
export async function deleteCampaign(
  db: Db,
  id: string,
  actorContactId: string | null,
): Promise<void> {
  const deleted = await db
    .delete(campaigns)
    .where(eq(campaigns.id, id))
    .returning({ id: campaigns.id });
  if (deleted.length === 0) return;
  await recordAudit(db, { kind: "campaign.deleted", actorContactId, details: { campaignId: id } });
}
