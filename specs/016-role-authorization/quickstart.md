# Quickstart: Authorization — Role × Capability × Scope

**Feature**: 016-role-authorization · **Date**: 2026-07-15

How to run and verify this feature. Details live in [data-model.md](data-model.md) and
[contracts/authorization.md](contracts/authorization.md); this is the run/validate guide.

---

## Prerequisites

⚠️ **Every `node`/`pnpm` command needs this first** — the shell defaults to Node 18:

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 24 >/dev/null 2>&1
```

Postgres 16 running locally; `.env` present. Feature 015 already configured Google sign-in.

### 🛑 Before migrating: snapshot `zak1_dev`

Migration 0021 is the **first destructive migration in this project** — it drops
`contacts.volunteer_roles` and the `volunteer_role` enum ([data-model.md](data-model.md) §7). `zak1_dev`
holds the user's real demo data (~1335 contacts, 1 volunteer). There is **no** rollback and
**`pnpm run db:seed` is not one** — it TRUNCATEs the database.

```bash
set -a; . ./.env; set +a
pg_dump -Fc "$DATABASE_URL" -f ~/zak1_pre_0021.dump
# restore, if it comes to that:
# pg_restore --clean --if-exists --no-owner -d zak1_dev ~/zak1_pre_0021.dump
```

Confirm the starting state (FR-013):

```bash
psql "$DATABASE_URL" -c \
  "SELECT display_name, volunteer_roles FROM contacts WHERE is_volunteer;"
# expect: Rich Dempsey | {}    ← EMPTY. Nobody holds a role; nobody ever has.
```

⚠️ **The empty array is the point.** `bootstrapOfficer`'s `--role` is optional and feature 015 did not use
it, so `volunteer_roles` has never had a holder. Migration 0021 therefore migrates **zero rows** into
`role_grants` — correctly. If you see `{administrator}` here, the database is not what this feature was
designed against; stop and re-check.

---

## Run

```bash
pnpm run db:migrate     # applies 0021_role_authorization.sql
pnpm test               # full suite, real Postgres
pnpm exec tsc --noEmit
pnpm run lint           # eslint + markdownlint
```

### 🧊 Then bootstrap the first Super-user — the database now has ZERO grants

After 0021 nobody can write anything, including you. This is by design, not breakage
([data-model.md](data-model.md) §7a): FR-030a makes the CLI the **only** source of a Super-user.

```bash
pnpm run auth:bootstrap -- --email <operator@cdrochester.org> --role super_user
```

Verify:

```bash
psql "$DATABASE_URL" -c \
  "SELECT c.display_name, g.role, g.series_id, g.group_id
     FROM role_grants g JOIN contacts c ON c.id = g.contact_id;"
# expect: Rich Dempsey | super_user | NULL | NULL   (club-wide)
```

Both NULLs **is** club-wide scope — not missing data ([data-model.md](data-model.md) §3). From here the
Super-user grants a President in the UI and the club is self-sufficient.

---

## Verify in the app

```text
preview_start { name: "dev" }    # port 3000; never run dev servers via Bash
```

Sign in at `/login`. As the migrated Super-user you can write anything — which proves the migration, not
the authorization. To see enforcement, grant yourself something narrower and check the boundary.

### The scenarios worth driving by hand

Everything below is covered by integration tests; these are the ones where *watching it* tells you
something a green test does not.

| # | Do this | Expect | Spec |
|---|---|---|---|
| 1 | Grant **Booker of ecd**; edit an ecd event, then a tnc event | ecd saves; tnc is **refused, naming the capability** | US1.1–2, SC-002 |
| 2 | As **Door Attendant**, open `/gate` | Figures **render**; every write is refused | US1.3, SC-003 |
| 3 | As a volunteer with **no grants**, open the treasurer report | Readable — **including individual performer pay** | US1.10, SC-004 |
| 4 | Same actor, open a contact | Name shows; **email and phone are absent** | US1.11, SC-004 |
| 5 | Grant a **group scope** on a group spanning tnc+ecd; act on its ecd event | Succeeds — with **no ecd series grant** | US1.7, SC-005 |
| 6 | Grant **Treasurer**, then try to grant that person **VP** | **Refused** — mutually exclusive | US2.5, SC-016 |
| 7 | Grant **FS** to a sitting President | **Succeeds, with a warning**; appears on the annual review | US2.7 |
| 8 | Clear a volunteer holding 3 grants | All 3 **listed first**; on confirm, all revoked + audited | US2.13–14, SC-015 |
| 9 | Re-designate that person a volunteer | **Zero grants** — nothing silently restored | US2.15 |

Scenario **2** is the one to actually look at: it is the club's one hard boundary, and it is a *write*
boundary — the page rendering with live money on it is correct, not a leak (`use-cases.md` §4).

Scenario **3** looks like a bug on first sight and is not. Every volunteer reads all the money, individual
pay included, because the club holds that **pay secrecy enables performers to be exploited**. Do not
"fix" it.

### Confirm the audit trail is a table, not logs

SC-014 is the reason `audit_events` exists (research R8). Prove it without touching a log file:

```bash
psql "$DATABASE_URL" -c \
  "SELECT actor_contact_id, sum((details->>'count')::int) AS contacts_seen
     FROM audit_events
    WHERE kind = 'pii.disclosed' AND occurred_at > now() - interval '30 days'
    GROUP BY 1 ORDER BY 2 DESC;"
```

Do a check-in search first, then re-run. **One row per request, with a count** — not one per contact
(FR-017b). Typing "John" fires a search per keystroke over 20 candidates; if you see 80 rows, the
granularity is wrong.

---

## Gotchas

- **`pnpm run db:seed` WIPES `zak1_dev`.** It is never the fix for a bad migration. Restore the dump.
- **The test harness's staff is a Super-user** (research R12). `seedTestStaff()` grants it club-wide
  `super_user` — without that, ~291 existing tests fail on writes they were never about. Authorization
  tests must build their **own** scoped actors; asserting against the harness actor proves nothing.
- **"Zztest Staff" still pollutes contact counts** (015). Exclude it explicitly; never expect "+1".
- **Both scope columns NULL means club-wide**, not unset. A grant "missing" its series is the most
  powerful kind.
- **Two Presidents are legal** (FR-005c). If a unique index appears on `role_grants(role)`, it is a bug.
- The **annual review never gates access** (FR-037). If sign-in starts failing for stale volunteers,
  something has read `volunteer_approved_at` on the session path — remove it.

---

## Done when

- `pnpm test` green (expect **~291 + new**), `tsc --noEmit` clean, `pnpm run lint` clean.
- Rich Dempsey holds `super_user` club-wide and can still sign in and write (FR-013).
- Scenarios 1–9 behave as tabled.
- `audit_events` answers SC-014's question in SQL.
- `/dev/routes` is **gone**, and its convention is gone from `CLAUDE.md` (FR-040) — both halves.
