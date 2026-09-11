# Phase 1 Data Model: Merge relinking

## The classification

Every foreign key whose target is `contacts` — all 24 columns, enumerated from the live schema — with its
disposition. This table **is** the feature: it drives the relink loop, and the parity guard (FR-002a)
asserts it covers the database exactly.

Note the classification is per **column**, not per table: `dedup_rejections` appears three times and falls
on both sides.

### `move` — the survivor inherits (11)

| Table.column | On delete | Collision risk | Note |
|---|---|---|---|
| `contact_emails.contact_id` | CASCADE | login label, per contact | already moved |
| `membership_accounts.payer_contact_id` | NO ACTION | unique payer → `two_accounts` hold | already moved |
| `membership_members.contact_id` | CASCADE | PK `(account_id, contact_id)` → drop duplicate | already moved |
| `attendance.contact_id` | SET NULL | `(event_id, contact_id)` → **drop duplicate** | new |
| `gate_sales.contact_id` | SET NULL | none | new |
| `membership_captures.contact_id` | SET NULL | none | new |
| `performers.contact_id` | SET NULL | none | new — the seven stranded records |
| `officers.contact_id` | CASCADE | none (unique on the seat) | new |
| `venues.landlord_contact_id` | SET NULL | none | new |
| `role_grants.contact_id` | CASCADE | `(contact_id, role, series_id, group_id)` → drop duplicate; **or `role_conflict` hold** | new, conditional |
| `staff_identities.contact_id` | CASCADE | unique per contact → **`two_logins` hold** | new, conditional |

### `leave` — a record of who did something (12)

Rewriting any of these would falsify the historical record (FR-003).

| Table.column | Why it stays |
|---|---|
| `status_change_audit.contact_id` | the retired contact's own status history |
| `merge_audit.canonical_id`, `merge_audit.merged_id` | names the merge that happened |
| `audit_events.actor_contact_id` | who performed an action |
| `dedup_rejections.rejected_by` | who judged a pair |
| `held_merges.attempted_by` | who attempted a merge |
| `contacts.volunteer_approved_by` | who approved a volunteer |
| `role_grants.granted_by` | who granted a role |
| `dedup_rejections.contact_a_id`, `dedup_rejections.contact_b_id` | the pair judged, as it was; a merged contact is excluded from the pair query, so a stale row can never match |
| `held_merges.canonical_id`, `held_merges.merged_id` | the merge attempted, as it was; the hold auto-closes when either contact is retired |

### `structural` — the merge mechanism itself (1)

| Table.column | Why |
|---|---|
| `contacts.merged_into_id` | This *is* the retirement marker, not an attachment. It is never re-pointed: flattening a chain would rewrite which merge actually happened. Readers that need the final survivor follow the chain. |

## New and changed state

### `held_merge_reason` — one new value

`two_logins` | `two_accounts` | **`role_conflict`**

Added by migration. In Postgres a new enum value must be committed before it can be used, so it lands in
its own migration ahead of any code that references it.

### `held_merges` — unchanged shape

The new reason reuses the existing row entirely: the pair, the reason, who attempted it, when, and
`resolved_at`. The partial unique index on `(canonical_id, merged_id) WHERE resolved_at IS NULL` continues
to collapse repeated attempts into one standing hold.

### Hold triggers — the complete set after this feature

| Reason | Raised when | Authority to resolve | Resolution names |
|---|---|---|---|
| `two_accounts` | both contacts own a membership account | `dedup.write` | the surviving account |
| `two_logins` | both contacts can sign in | `role.assign` | the surviving **sign-in** — account binding *and* its address, together (corrected; 069 named the address alone) |
| `role_conflict` | survivor would **gain** `role.assign`, **or** the union would hold two mutually exclusive offices | `role.assign` | which of the merged record's grants move — possibly none |

### Auto-close conditions (FR-010a)

A hold closes itself, merging nothing, when its cause is gone. Existing: either contact merged away or
archived; fewer than two logins; fewer than two accounts. **New**: for `role_conflict`, when the union no
longer triggers — the conflicting grant was withdrawn on the access screen. This is what makes a hold
recoverable without a resolution screen.

## Entities in spec terms

| Spec entity | Realised as |
|---|---|
| Retired contact | `contacts.merged_into_id IS NOT NULL OR archived_at IS NOT NULL` — the existing `activeContact()` predicate, negated |
| Survivor | the contact at the end of the `merged_into_id` chain |
| Attachment | any `move` row above |
| Surviving sign-in | a `staff_identities` row **and** the `contact_emails` row carrying `is_login`, chosen together |
| Held merge | a `held_merges` row with `resolved_at IS NULL` |
| Role-assigning authority | a role whose capability set contains `role.assign` |
| Mutually exclusive offices | `EXCLUSIVE_ROLES` in `grantService.ts` — President, Vice-President, Treasurer |

## Historical repair (FR-015)

Nine records stranded by past merges, repaired by a **tested routine** run once — not a migration, since a
backfill inside one could never be exercised against realistic input (see [research.md](./research.md) R7):

| Category | Count |
|---|---|
| `performers.contact_id` | 6 |
| `attendance.contact_id` | 2 |
| `membership_members.contact_id` | 1 (predates feature 069) |

Two properties the repair must have, both verified against current data:

- **Resolve the full chain.** Three contacts were merged into a target that was itself later merged, so a
  single hop would leave records pointing at another retired contact. Follow `merged_into_id` until the
  contact is live.
- **Tolerate collisions.** Apply the same drop-the-duplicate rule as a live merge. Currently clean —
  neither stranded attendance row has a survivor who also attended — but the repair must not rely on
  that.

Records on **archived** contacts are excluded: there is no survivor to move to. That is the seventh
performer, and it stays where it is.
