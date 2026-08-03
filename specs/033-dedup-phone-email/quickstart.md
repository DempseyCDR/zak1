# Quickstart / Validation: Dedup review shows phone + email (P5-R7)

Bash runs Node 24 (no prefix). Prereqs: `pnpm install`; local Postgres up (`zak1_dev`/`zak1_test`). No
migration.

## Automated validation (the gate)

```bash
pnpm exec vitest run tests/integration/dedup.phoneEmail.test.ts tests/component/dedup.phoneEmail.test.tsx
pnpm exec tsc --noEmit
pnpm exec eslint <changed files>
pnpm exec prettier --check <changed files>
pnpm test          # full suite green
pnpm build         # production build clean
```

### Expected assertions (mapped to the story)

- **US1 / FR-001, 005 (integration)**: `getMergeSuggestions` returns, for each candidate of a proposed pair,
  its `phone` and its **active** `emails`; an inactive/transition email is **excluded**; a candidate with no
  active email has `emails: []`.
- **FR-004 (integration)**: seed two same-name contacts → the pair is proposed exactly as before (set/order
  unchanged) — the added columns don't alter matching.
- **US1 / FR-002, 003, 006 (component)**: the `/dedup` page shows each candidate's **dashed** phone (via
  `formatPhone`) and email(s); a candidate with no phone shows "no phone", with no email shows "no email"; the
  merge controls and empty state are unchanged.

## Manual smoke (optional)

1. `pnpm dev`, sign in as staff, open `/dedup`.
2. For a proposed pair, confirm each side shows display name + membership status **plus phone (dashed) and
   email**.
3. Two coincidental same-name contacts with different phones/emails read as clearly different, so you can
   decline the merge without a separate lookup.
