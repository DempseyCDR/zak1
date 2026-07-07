# Quickstart / Validation Guide

How to prove this feature works end-to-end. Implementation details live in `tasks.md`; contracts and
schema deltas are in `contracts/api-deltas.md` and `data-model.md`.

## Prerequisites

- Local Postgres with `zak1_dev` and `zak1_test` databases (existing project setup).
- Migration `0015_retire_jab_and_freetext_kind.sql` applied.

## Setup

```bash
npm run db:migrate     # apply 0015 to zak1_dev
npm run db:seed        # reseed (JAB "most recent year" seed intent removed)
```

## Automated validation (primary)

```bash
npm test               # Vitest against zak1_test
```

Expected: green suite, including updated/added tests that assert —

- `GET /api/exports` returns exactly 6 standing lists and no `janeaustenball`; response items have no
  `note` field. *(FR-001, FR-002, FR-004, SC-001)*
- Creating an event group with an arbitrary `kind` (e.g., "double dance") succeeds; a fixed set is not
  enforced; `kind` may be omitted. *(FR-006, FR-007, SC-003, SC-006)*
- The contact-tracing export on a JAB event still returns that event's consented attendees. *(FR-005,
  SC-002)*
- A contact email can set/read the `jane_austen_ball` consent topic. *(FR-009, SC-005)*
- Migration guard: a `mailing_list_exports` row holding `janeaustenball` would abort the enum
  recreation (documents the FR-003 safety property).

## Manual smoke check (secondary)

```bash
npm run dev
```

1. Visit `/exports` → six standing mailing lists listed; Jane Austen Ball is absent; no "Most recent
   JAB" note anywhere.
2. Visit `/events` → the "New event group" form shows a **free-text** category input (not a dropdown);
   create a group with category "double dance" and one with the category left blank; both save.
3. Visit `/contacts` → a contact email still offers the Jane Austen Ball consent topic and it persists.
4. (Optional) Run the contact-tracing export on a Jane Austen Ball event → consented attendees returned
   as before.

## Success signals

All six SC-00x measurable outcomes in `spec.md` hold: 6 lists, unchanged contact-tracing result,
free-text category accepted first try, existing categories retained (prettified), consent topic intact,
empty category allowed.
