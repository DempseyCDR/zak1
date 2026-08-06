# Quickstart / Validation: Organizer Report Band Name (+ member detail)

Prove the band-name change end to end. No migration — `pnpm run db:migrate` is a no-op for this feature.

## Prerequisites

- Local Postgres up; `zak1_test` auto-migrated (integration) and `zak1_dev` for the manual check.

## Automated validation (primary proof — test-first)

```bash
# RED first, then GREEN:
pnpm exec vitest run tests/integration/organizer.report.test.ts \
                     tests/component/organizer.page.test.tsx
# Full gate before commit:
pnpm exec tsc --noEmit && pnpm run lint && pnpm exec vitest run
```

**Integration (`organizer.report.test.ts`)** — seed a dance where two musicians are booked under a **named band**
(insert a `bands` row, then `createBooking(..., bandId)` for each member), plus separate dances for the other
cases. Assert:

- Named-band dance → `perDanceRows[i].band ===` the band's name.
- Ad-hoc dance (two musicians, no `bandId`) → `band ===` the joined member names (unchanged).
- Open-band-only dance → `band === "Open Band"`; caller-only dance → `band === ""`.
- Multiple named bands on one dance → `band ===` the two names joined.
- **Figure parity**: dancers, gross, performer total, dance net, avg ticket, quarterly + trend numbers are exactly
  as before (the band-string change touched nothing else).

**Component (`organizer.page.test.tsx`, new)** — stub the report fetch with a fixture whose row has
`band: "The Fiddleheads"` and a `performers` list; assert the band column shows "The Fiddleheads", and that
expanding the dance's row reveals the members by name and role (type) and shows the band name.

## Manual smoke (secondary; staff-only page)

1. `pnpm dev`, sign in as an organizer (or Super-user), open `/organizer/tnc`.
2. Find a dance where a named band played → the band column shows the **band name** (not the member list).
3. Click the row → the detail lists the **members by name and role** and shows the band name; the caller and any
   open-band musicians still appear.
4. Check an ad-hoc dance → the band column still shows the joined member names.

## Success = all of

- Integration + component tests green; `tsc` + lint + full suite green.
- Named-band dances show the band name; ad-hoc / open-band / empty cases unchanged.
- The drill-in detail lists band members by name and role.
- No computed figure changed (parity assertion passes).
