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
  await sql`TRUNCATE series_expense_parameters, misc_expenses, account_mapping, series_qbo_map, treasurer_report_audit, mapping_audit, non_dance_income, bookings, rate_parameter_audit, rate_parameters, performers, door_record_audit, gate_sales, door_records, attendance, quarterly_attendance_counts, events, event_groups, merge_audit, status_change_audit, memberships, payers, contact_emails, contacts RESTART IDENTITY CASCADE`;
  // series + QBO mapping are config (seeded once); ensure they exist for tests
  await sql`INSERT INTO series (key, name, has_sound_tech) VALUES
    ('tnc','Thursday Night Contra',true),
    ('ecd','Sunday English Country Dance',true),
    ('community_dance','Community Dance',false)
    ON CONFLICT (key) DO NOTHING`;
  await sql`INSERT INTO account_mapping (line_key, account_code, account_name) VALUES
    ('admission','4210','Program Service Revenue:Dance Gate'),
    ('merchandise','4700','Sales of Inventory'),
    ('donation','4100','Voluntary Contributions'),
    ('future_event','4200','Program Service Revenue'),
    ('membership','4300','Membership Dues'),
    ('gift_card','2201','Prepaid Services:Pre-paid Gift Card'),
    ('misc_sales','4900','Uncategorized Income'),
    ('caller','5320','Program Staff:Callers'),
    ('lead_musician','5310','Program Staff:Bands'),
    ('musician','5310','Program Staff:Bands'),
    ('sound_tech','5330','Program Staff:Sound Tech'),
    ('rent','5420','Facilities:Rent'),
    ('fees','5810','Bank Charges & Fees:PayPal Fees'),
    ('deposit','1021','ESL Checking'),
    ('non_dance_income','4910','Other Miscellaneous Revenue')
    ON CONFLICT (line_key) DO NOTHING`;
  await sql`INSERT INTO series_qbo_map (series_id, gate_customer, qbo_class)
    SELECT id, CASE WHEN key='ecd' THEN 'English Gate' ELSE 'Contra Gate' END,
           CASE key WHEN 'tnc' THEN 'TNC' WHEN 'ecd' THEN 'ECD' ELSE 'Community Dance' END
    FROM series ON CONFLICT (series_id) DO NOTHING`;
}

export async function closeDb(): Promise<void> {
  await sql.end();
}

export { db };
