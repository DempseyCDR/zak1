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
  await sql`TRUNCATE contact_emails, contacts RESTART IDENTITY CASCADE`;
}

export async function closeDb(): Promise<void> {
  await sql.end();
}

export { db };
