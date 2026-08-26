# Quickstart / Validation: Campaign / promotional slot (P7-R14)

Assumes the dev DB is migrated (`0040`) and the dev server runs.

## 0. Setup

```bash
pnpm run db:migrate      # applies 0040_campaigns.sql
pnpm dev
```

## 1. Gate suite (fast, no browser)

```bash
pnpm exec vitest run \
  tests/unit/campaignSelect.test.ts \
  tests/integration/campaign.test.ts \
  tests/integration/campaign.authz.test.ts \
  tests/component/campaignSlot.test.tsx
pnpm exec tsc --noEmit
pnpm run lint
```

Expected: the date-window boundary + the queue selector (earliest-end, ties, handoff) + validation; CRUD +
shown-selection + audit; `content.write` refusal; the slot renders (image/alt, text-only, internal/external CTA).

## 2. Post & see the slot (US1/US2) — browser

1. As a `content.write` actor at `/campaigns`, create a campaign: heading "Golden Celebration Weekend", a blurb,
   an image URL (`https://…`) + alt text, CTA label "Learn more" + CTA link (an internal path like `/golden-weekend`
   or an external `https://…`), start date today, end date a week out.
2. Load `/` (home) → the promotional slot shows **above the hero** with the heading, blurb, image, and CTA
   (SC-001). It does **not** appear on `/whats-on`, other public pages, or `(admin)`/`(door)` (home-only).
3. **View source** (scripts disabled): the heading, blurb, and CTA are present in the served HTML (FR-011).

## 3. Image + CTA (FR-003/008) — browser

- Create a campaign with **no image** → the slot renders a legible **text-only** card (SC-008).
- An **internal-path** CTA (`/golden-weekend`) opens in the same tab; an **external** `https://…` CTA opens in a
  new tab (`target=_blank rel=noopener`). Try a `javascript:` CTA or image URL → rejected on save (422, SC-006).

## 4. The queue: two active campaigns (US3/FR-014/SC-009) — browser or gate suite

- Create **two** active campaigns whose windows both include today with **different end dates** → the home slot
  shows only the one that **ends sooner** (SC-009).
- Delete (or let expire) the sooner-ending one → the later-ending campaign appears with **no** staff action
  (the handoff). (The unit test covers the just-before/just-after boundary and the nested-window case.)

## 5. Scheduled window (FR-006/SC-004) — browser or gate suite

- A campaign whose **start date is in the future** → no slot yet; whose **end date has passed** → no slot (auto
  retired), with no staff action. Boundaries flip on the next page load.

## 6. Manage the queue + empty state (US2/SC-003) — browser

- At `/campaigns`, the list shows every campaign with its **status** (upcoming/active/ended) and marks **which
  one is currently shown**. Edit a campaign → the public slot reflects it on reload. Remove all active campaigns
  → the home page renders with **no** slot and no layout shift (SC-003).

## 7. Authorization & audit (SC-005) — gate suite / browser

- A base volunteer cannot reach `/campaigns` or POST/PATCH/DELETE (403). Every create/edit/remove writes an
  `audit_events` row (`campaign.created` / `campaign.updated` / `campaign.deleted`).

## Success criteria mapping

| Criterion | Validated by |
|-----------|--------------|
| SC-001 above-the-fold on home | §2 |
| SC-002 publish/edit/remove no deploy | §2, §6 |
| SC-003 empty → no slot/shift | §6 |
| SC-004 scheduled window boundary | §5, §1 |
| SC-005 gated + audited | §7 |
| SC-006 only internal/http(s) links | §3, §1 |
| SC-007 reusable, no code change | §2, §6 |
| SC-008 text-only fallback + no h-scroll @375px | §3, §2 |
| SC-009 exactly one shown among active + handoff | §4, §1 |
