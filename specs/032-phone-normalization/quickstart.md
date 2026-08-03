# Quickstart / Validation: Phone number normalization (P5-R6)

Bash runs Node 24 (no prefix). Prereqs: `pnpm install`; local Postgres up (`zak1_dev`/`zak1_test`).

## Backfill the existing directory

```bash
# snapshot first (project practice for data migrations)
set -a; . ./.env; set +a; pg_dump -Fc "$DATABASE_URL" -f ~/zak1_pre_0030.dump
pnpm run db:migrate    # applies 0030_normalize_contact_phones.sql (values-only backfill; unparseable unchanged)
```

## Automated validation (the gate)

```bash
pnpm exec vitest run tests/unit/phone.test.ts tests/integration/contact.phoneNormalize.test.ts
pnpm exec tsc --noEmit
pnpm exec eslint <changed files>
pnpm exec prettier --check <changed files>
pnpm test          # full suite green (resetDb applies 0030 to the test DB)
pnpm build         # production build clean
```

### Expected assertions (mapped to stories)

- **US1 / FR-001–004, 007 (unit + integration)**: `normalizePhone` maps every punctuation of a number to one
  canonical value (`+1` default; 11-digit-leading-1 → `+1`; non-US `+` kept; unparseable → raw; idempotent).
  Creating a contact with a messy phone — via the **directory**, **check-in new-contact**, and **performer**
  paths — stores the canonical value at each site.
- **US2 / FR-005 (unit)**: `formatPhone` renders US as `585-555-1234`, non-US with its country code, and
  passes raw values through. (No live display surface yet — consumed by P5-R7.)
- **US3 / FR-006 (integration)**: seeding mixed-format phones, running the `0030` SQL, then asserting each
  result equals `normalizePhone(input)` (parity) and that unparseable values are unchanged; re-running the
  UPDATE changes nothing (idempotent).

## Manual smoke (optional)

1. `pnpm dev`, sign in as staff, open `/contacts`, create a contact with phone `(585) 555-1234`.
2. Confirm the stored value is `+15855551234` (DB check) — the same as entering `585.555.1234` or `5855551234`.
3. Enter `585-1234 x89` on another contact → stored raw (kept, not blocked).
