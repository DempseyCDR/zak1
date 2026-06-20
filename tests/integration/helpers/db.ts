import { resolveDatabaseUrl } from "@/server/validation/env";
import { runMigrations } from "@/server/db/migrate";
import { db, sql } from "@/server/db/client";

let migrated = false;

/** Ensure the test database schema exists (runs once per process). */
export async function ensureSchema(): Promise<void> {
  if (migrated) return;
  await runMigrations(resolveDatabaseUrl());
  migrated = true;
}

/** Truncate all feature tables between tests (preserves club_settings seed). */
export async function resetDb(): Promise<void> {
  await sql`TRUNCATE door_record_audit, gate_sales, door_records, attendance, quarterly_attendance_counts, events, event_groups, merge_audit, status_change_audit, memberships, payers, contact_emails, contacts RESTART IDENTITY CASCADE`;
  // series is config (seeded once); ensure the three exist for tests
  await sql`INSERT INTO series (key, name, has_sound_tech) VALUES
    ('tnc','Thursday Night Contra',true),
    ('ecd','Sunday English Country Dance',true),
    ('community_dance','Community Dance',false)
    ON CONFLICT (key) DO NOTHING`;
}

export async function closeDb(): Promise<void> {
  await sql.end();
}

export { db };
