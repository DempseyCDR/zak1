# Phase 1 Data Model: Triage Mode — Worklists

## Schema change

Two additive tables. Nothing existing is altered or dropped. Migration **0044**.

```sql
-- A recorded human judgement that a proposed pair is NOT one person (FR-002).
CREATE TABLE dedup_rejections (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_a_id  uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  contact_b_id  uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  -- The names AS JUDGED. Suppression holds only while both still match (FR-003a), so the rejection
  -- lapses through ANY path that changes a name — including ones added later — with no clearing hook.
  a_dedup_normalized text NOT NULL,
  b_dedup_normalized text NOT NULL,
  rejected_by   uuid REFERENCES contacts(id),
  rejected_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (contact_a_id < contact_b_id)          -- one row per unordered pair, matching the query
);
CREATE UNIQUE INDEX dedup_rejections_pair ON dedup_rejections (contact_a_id, contact_b_id);

-- A merge that could not complete because the survivor may hold only one of something both parties have.
CREATE TABLE held_merges (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_id  uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  merged_id     uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  reason        held_merge_reason NOT NULL,     -- 'two_logins' | 'two_accounts'
  attempted_by  uuid REFERENCES contacts(id),
  attempted_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz
);
CREATE UNIQUE INDEX held_merges_pair_open ON held_merges (canonical_id, merged_id)
  WHERE resolved_at IS NULL;                    -- one open hold per pair
```

| Decision | Why |
|---|---|
| Rejection stores the **judged names** | FR-003a. Four code paths write `dedup_normalized`; a flag would need four clearing hooks and would fail silently if one were missed. |
| `CHECK (a < b)` | The suggestion query emits each unordered pair once as `a.id < b.id`; storing rejections the same way makes suppression a direct match rather than a two-way comparison. |
| `ON DELETE CASCADE` on both contacts | A rejection or hold about a deleted contact describes nothing. |
| `resolved_at` rather than deletion | A held merge is a governance event; keeping it resolved preserves the trail (Principle IV). |
| Partial unique on open holds | A pair can be held, resolved, and — if the collision recurs — held again. |
| No `rejected_reason` free text | YAGNI: the judgement is binary, and the names + who + when are what make it explicable. |

## Entities

### Duplicate suggestion (not stored)

Recomputed whenever the queue is opened, from **name similarity alone** at a 0.4 trigram threshold over
`dedup_normalized`. Because it is not stored, anything that suppresses a pair must be stored separately —
which is what `dedup_rejections` is for. Already excluded, unchanged: merged contacts, archived contacts,
and pairs already linked as a shared household (feature 067).

### Rejection

| Invariant | Source | Enforcement |
|---|---|---|
| One row per unordered pair | FR-002 | `CHECK (a<b)` + unique index |
| Suppresses only while **both** judged names still match | FR-003/FR-003a | Compared in the suggestion query |
| A display-name override change does **not** lapse it | FR-003 | Structural — `dedup_normalized` ignores the override (feature 012) |
| Attributable and reversible | FR-004/FR-004a | `rejected_by` / `rejected_at`; deleting the row restores the pair |

### Held merge

| Invariant | Source | Enforcement |
|---|---|---|
| Changes no contact data | FR-013 | The merge transaction rolls back before any write |
| Names both contacts and the reason | FR-014 | Columns |
| Independent of a contact's review flag | FR-014a | Separate table; neither clears the other |
| Does not outlive its cause | Edge case | Resolved automatically when either side is merged away, archived, or no longer collides |

## The merge, as three outcomes

Today `mergeContacts` either completes or throws — including throwing a **raw database error** when both
contacts hold a sign-in email. It becomes a discriminated result:

```text
completed → everything moved to the survivor; merged contact retired
held      → nothing changed; a held_merges row raised (two_logins | two_accounts)
refused   → invalid request (same contact, already merged, not found) — as today
```

**What a completed merge moves** (the corrected set):

| Moved to the survivor | Note |
|---|---|
| `contact_emails` | Every email, whatever its status (FR-009/M-R20) |
| `membership_accounts.payer_contact_id` | **NEW** — 068 left this behind; see below |
| `membership_members.contact_id` | **NEW** — attachments follow the person |
| ~~`memberships`, `payers`~~ | **REMOVED** — retired by 068 and read by nothing |

### The two collisions

Both are a survivor being allowed only one of something both parties hold:

| Collision | Constraint | Resolver |
|---|---|---|
| Both contacts sign in | `contact_emails_one_login_per_contact` | Needs `role.assign`; choose the surviving sign-in inline (FR-012) |
| Both own an account | `membership_accounts_payer` (UNIQUE on payer) | A membership decision; choose which account survives |

Neither may be resolved automatically: discarding a sign-in changes someone's access, and discarding an
account destroys a household's paid term.

## State transitions

```text
pair suggested ──reject──────────▶ suppressed        (while both names match)
pair suggested ──link as shared──▶ excluded          (067 — no rejection needed)
pair suggested ──merge───────────▶ completed | held
suppressed     ──name changes────▶ suggested again   (automatic; no write)
suppressed     ──un-reject───────▶ suggested again   (FR-004a)
held           ──resolved────────▶ merge completes, hold closed
held           ──cause removed───▶ hold closed, nothing merged
```

Note that "suppressed → suggested again" needs **no write at all**: the comparison is evaluated at query
time, so the pair reappears the moment a name differs from the one judged.
