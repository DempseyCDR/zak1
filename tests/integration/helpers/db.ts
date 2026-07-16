import { resolveDatabaseUrl } from "@/server/validation/env";
import { runMigrations } from "@/server/db/migrate";
import { db, sql } from "@/server/db/client";
import { contactEmails, contacts, roleGrants, staffIdentities } from "@/server/db/schema";
import { deriveContactNames } from "@/server/domain/contacts/normalize";
import { createSession } from "@/server/auth/session";

let migrated = false;

/** Ensure the test database schema exists (runs once per process). */
export async function ensureSchema(): Promise<void> {
  if (migrated) return;
  await runMigrations(resolveDatabaseUrl());
  migrated = true;
}

/** Truncate all feature tables between tests (preserves club_settings seed). */
export async function resetDb(): Promise<void> {
  await sql`TRUNCATE role_grants, audit_events, staff_sessions, staff_identities, mailing_list_exports, series_parameters, series_parameter_audit, venue_rents, venue_rent_audit, misc_expenses, account_mapping, series_qbo_map, treasurer_report_audit, mapping_audit, non_dance_income, band_members, bands, bookings, performers, door_record_audit, gate_sales, door_records, attendance, quarterly_attendance_counts, events, event_groups, venues, merge_audit, status_change_audit, memberships, payers, contact_emails, contacts RESTART IDENTITY CASCADE`;
  // series + QBO mapping are config (seeded once); ensure they exist for tests
  await sql`INSERT INTO series (key, name, has_sound_tech) VALUES
    ('tnc','Thursday Night Contra',true),
    ('ecd','Sunday English Country Dance',true),
    ('community_dance','Community Dance',false),
    ('general','General / Joint Events',true)
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

  await seedTestStaff();
}

/**
 * A standing signed-in staff member for the whole suite (feature 015).
 *
 * `/api/*` became default-deny, so route tests need a session. Rather than teach 50-odd pre-auth test
 * files about authentication, the shared harness supplies one and `jsonReq` attaches its cookie.
 *
 * NOT a bypass: `withAuth` runs in full for every request, and the real 401/revocation behaviour is
 * proven in auth.protection.test.ts with hand-built unauthenticated requests.
 *
 * Deliberately INERT so it cannot pollute assertions in other features: `do_not_contact` keeps it out
 * of every mailing-list export, and it is never a member or list member.
 */
/** The harness's standing staff member. Exported so contact-facing tests can exclude it explicitly
 *  rather than silently expecting "+1". */
export const TEST_STAFF_DISPLAY_NAME = "Zztest Staff";
export const TEST_STAFF_EMAIL = "zztest.staff@cdrochester.org";
export const TEST_STAFF_GOOGLE_SUB = "test-staff-google-sub";

let currentSessionToken: string | null = null;

async function seedTestStaff(): Promise<void> {
  const names = deriveContactNames({ firstName: "Zztest", lastName: "Staff" });
  const [contact] = await db
    .insert(contacts)
    .values({
      firstName: "Zztest",
      lastName: "Staff",
      displayName: names.displayName,
      nameNormalized: names.nameNormalized,
      dedupNormalized: names.dedupNormalized,
      isVolunteer: true,
      listMember: false,
      membershipStatus: "never",
    })
    .returning();
  if (!contact) throw new Error("test staff contact insert failed");

  await db.insert(contactEmails).values({
    contactId: contact.id,
    email: TEST_STAFF_EMAIL,
    consentTopics: ["do_not_contact"],
    status: "active",
    isLogin: true,
  });

  const [identity] = await db
    .insert(staffIdentities)
    .values({ contactId: contact.id, googleSub: TEST_STAFF_GOOGLE_SUB })
    .returning();
  if (!identity) throw new Error("test staff identity insert failed");

  // R12 — the harness actor holds a CLUB-WIDE super_user grant.
  //
  // Feature 016 makes every write require a grant. This contact was seeded by 015 with no roles, so
  // without this it would hold only the Organizer base (read all but PII, write NOTHING) and ~291
  // tests across 112 files would fail on writes they are not about.
  //
  // Super-user rather than "every role" because "every role" is not a legal state: President, VP and
  // Treasurer are mutually exclusive (FR-005a). And a real grant rather than a test-mode bypass, on
  // 015's own precedent — a bypass means the protection is never exercised.
  //
  // ⚠️ Authorization tests must build their OWN scoped actors (see factories). Asserting against this
  // actor proves nothing: it can do everything.
  await db.insert(roleGrants).values({ contactId: contact.id, role: "super_user" });

  const { token } = await createSession(db, identity.id);
  currentSessionToken = token;
}

/** The standing staff session token. Valid only after `resetDb()`. */
export function testSessionToken(): string {
  if (!currentSessionToken) throw new Error("testSessionToken(): call resetDb() first");
  return currentSessionToken;
}

export async function closeDb(): Promise<void> {
  await sql.end();
}

export { db };
