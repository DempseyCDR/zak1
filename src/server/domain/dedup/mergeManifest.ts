import { z } from "zod";

/**
 * Feature 074 (FR-001 to FR-004): everything needed to reverse one merge.
 *
 * ## Why a manifest exists at all
 *
 * `merge_audit.relinked_counts` has recorded how MUCH a merge moved since feature 033. It cannot say
 * WHAT moved, and nothing else can either: once a `contact_emails` row sits on the survivor, no column
 * distinguishes it from a row the survivor always had. That is why no merge before this feature is
 * reversible and why none can be made so retroactively — the information was never written down.
 *
 * ## Names are always the DATABASE's names
 *
 * Every `table`, `column` and key inside a manifest is snake_case, exactly as Postgres spells it, and
 * every capture and restore goes through raw SQL rather than Drizzle's mapped helpers. That is a
 * deliberate single convention: Drizzle's `.returning()` yields camelCase while `tx.execute` yields
 * snake_case, and a manifest holding a mixture of the two would be a bug waiting for whichever table was
 * captured by the other path. The merge already builds dynamic statements across a dozen tables, so raw
 * SQL is the natural tool here and not a concession.
 */

/** A row's primary-key tuple. Values are stringified ids; column names are the database's. */
export const rowKeySchema = z.record(z.string(), z.string());
export type RowKey = z.infer<typeof rowKeySchema>;

/**
 * A row as the database returned it, snake_case keys. `unknown` rather than a narrower type because a
 * snapshot spans eleven tables with no common shape; it is never read field-by-field, only re-inserted.
 */
const rowSnapshotSchema = z.record(z.string(), z.unknown());

const baseEntry = {
  /** Bare table name, matching `contactReferences.table`. */
  table: z.string().min(1),
  /** The row's primary key AS IT STANDS AFTER THE MERGE — see `contactReferences.pk` for why. */
  key: rowKeySchema,
  /**
   * Marks an entry that changes who can sign in, subjecting it to the `role.assign` gate (FR-024).
   * Set on every `staff_identities` entry and on the `contact_emails.is_login` overwrite that labels
   * one. Absent, rather than `false`, when it does not apply — a manifest is stored forever and the
   * smaller shape is the one worth keeping.
   */
  accessChanging: z.literal(true).optional(),
};

export const manifestEntrySchema = z.discriminatedUnion("kind", [
  /** The merge re-pointed this row's contact column at the survivor. */
  z.object({
    ...baseEntry,
    kind: z.literal("move"),
    column: z.string().min(1),
    /** The contact it came from — the retired one. Undo sets `column` back to this. */
    fromContactId: z.string().uuid(),
  }),
  /** The merge inserted this row. Undo deletes it. */
  z.object({ ...baseEntry, kind: z.literal("create") }),
  /** The merge deleted this row. Undo re-inserts it exactly as it was. */
  z.object({ ...baseEntry, kind: z.literal("destroy"), row: rowSnapshotSchema }),
  /** The merge changed one field on a row it left in place. Undo puts the old value back. */
  z.object({
    ...baseEntry,
    kind: z.literal("overwrite"),
    column: z.string().min(1),
    previousValue: z.unknown(),
  }),
]);

export type ManifestEntry = z.infer<typeof manifestEntrySchema>;
export type ManifestEntryKind = ManifestEntry["kind"];

/**
 * `version` is not speculative future-proofing — it is the thing that makes a stored manifest safe to
 * read. A manifest outlives the code that wrote it, so the shape it was written under has to be
 * recoverable. Zod then refuses anything that does not match, rather than half-reading it (Principle
 * III): a partially-understood manifest would produce a partially-reversed merge, which is worse than
 * refusing to reverse at all.
 */
export const MANIFEST_VERSION = 1 as const;

export const reversalManifestSchema = z.object({
  version: z.literal(MANIFEST_VERSION),
  entries: z.array(manifestEntrySchema),
});

export type ReversalManifest = z.infer<typeof reversalManifestSchema>;

/**
 * Parse a manifest read from the database. Returns `null` for SQL NULL — a merge recorded before this
 * feature, which is the FR-007 un-reversible signal and NOT an error. Anything present but malformed
 * throws, because that is a real defect and must not be silently treated as "no manifest".
 */
export function parseManifest(raw: unknown): ReversalManifest | null {
  if (raw === null || raw === undefined) return null;
  return reversalManifestSchema.parse(raw);
}

/** Why an entry could not be applied (FR-018). */
export const SKIP_REASONS = ["gone", "occupied", "not_authorized"] as const;
export type SkipReason = (typeof SKIP_REASONS)[number];

export type SkippedEntry = {
  kind: ManifestEntryKind;
  table: string;
  key: RowKey;
  reason: SkipReason;
};

/**
 * Accumulates entries as the merge works. Exists so no call site hand-assembles an entry: a `move`
 * missing its `fromContactId`, or a key built from the wrong columns, would be recorded happily and only
 * surface as a failed undo weeks later.
 */
export type ManifestBuilder = {
  move: (e: {
    table: string;
    column: string;
    key: RowKey;
    fromContactId: string;
    accessChanging?: true;
  }) => void;
  create: (e: { table: string; key: RowKey }) => void;
  destroy: (e: {
    table: string;
    key: RowKey;
    row: Record<string, unknown>;
    accessChanging?: true;
  }) => void;
  overwrite: (e: {
    table: string;
    key: RowKey;
    column: string;
    previousValue: unknown;
    accessChanging?: true;
  }) => void;
  build: () => ReversalManifest;
  /** Entry count, for the merge's own reporting. */
  size: () => number;
};

export function manifestBuilder(): ManifestBuilder {
  const entries: ManifestEntry[] = [];
  return {
    move: (e) => entries.push({ kind: "move", ...e }),
    create: (e) => entries.push({ kind: "create", ...e }),
    destroy: (e) => entries.push({ kind: "destroy", ...e }),
    overwrite: (e) => entries.push({ kind: "overwrite", ...e }),
    build: () => ({ version: MANIFEST_VERSION, entries }),
    size: () => entries.length,
  };
}

/**
 * Pull a row's primary-key tuple out of a raw query result, given the key's column names.
 *
 * Throws on a missing or null key column rather than recording a partial key. A key is the only handle
 * an undo has on a row; half of one is not a smaller problem than none, it is a silent failure to
 * restore that row later.
 */
export function rowKey(row: Record<string, unknown>, pkColumns: readonly string[]): RowKey {
  const key: RowKey = {};
  for (const col of pkColumns) {
    const value = row[col];
    if (value === undefined || value === null) {
      throw new Error(
        `manifest: row is missing primary-key column "${col}" — cannot record it reversibly`,
      );
    }
    key[col] = String(value);
  }
  return key;
}
