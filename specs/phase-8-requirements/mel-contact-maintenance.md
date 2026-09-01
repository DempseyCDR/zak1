# Phase 8 — Mel's Area: Contact & Mailing-List Maintenance (requirements draft)

**Status:** pre-SpecKit requirements draft (developed conversationally; will seed `/speckit-specify`).
**Phase 8 goal:** make it easy for volunteers to maintain the data they own. This doc covers **Mel**,
the mailing-list manager, maintaining basic contact records and email/mailing-list permissions.

Requirement IDs are `M-Rn` for reference. Anything marked _(open)_ is not yet decided.

---

## 1. Actor & authority

- **Mel** holds `mailing_list_manager`. Often — not always — the same person is also VP, so the UI
  must reflect **whichever capabilities the viewer actually holds** (authority is the union of grants),
  never a hard-coded "Mel" assumption.
- **M-R1** — `mailing_list_manager` gains **`contact.write`** (today it has only `contact.mailing.write`,
  which covers emails/consent, not the contact record itself).
- **M-R2** — **`contact.mailing.write` becomes `global`** for `mailing_list_manager` (today `scoped`).
  Mel edits consent/purposes/status on **any** contact's emails, across all topics — not only her
  series'. (Joins `export.read` as the global-among-scoped exceptions noted in the feature-016 catalog.)

## 2. Foundational principles (cross-cutting, apply beyond Mel)

- **X-R1 — Mobile-first admin.** Almost all admin/volunteer surfaces get the same clean, mobile-first
  treatment as the Phase-7 public site, reusing the P7 design tokens and component patterns rather than
  the current raw dev-scaffold forms (e.g. `src/app/(admin)/contacts/page.tsx`).
- **X-R2 — Two interaction paradigms.** Maintenance splits into **Record mode** (everything about one
  contact) and **Triage mode** (working through a _list_ of pending tasks). The UI reflects the
  difference gracefully; the two meet at the edges (a triage item opens into record mode / the merge
  view to resolve).
- **X-R3 — Fix `searchContacts` (shared search). PRIORITY: high — do early in the Phase-8 build.**
  `searchContacts` backs the door check-in lookup, Mel's maintenance search (M-R3/M-R4), and the access
  roster, so this one fix improves all three. Deferred to build start (not patched now), but sequenced
  first.
  - **Defect — non-monotonic, length-biased matching.** The only matcher is the pg_trgm operator
    `name_normalized % needle`, true only when `similarity() ≥ 0.3` (default threshold). Trigram
    similarity is `shared ÷ union` of 3-grams, so a short/prefix query scores low against a longer name
    ("cat" vs "catherine jones" ≈ 0.19 → no match) and, worse, typing **more** can _remove_ matches and
    _add_ new ones (observed: `cath` → Cathy McGrath + Catherine; `cathe` → loses Cathy; `cather` →
    gains Catherine Hughes + Sloboda). Wrong model for incremental typing.
  - **Fix — substring-primary matching.** Make `name_normalized ILIKE '%needle%'` the primary matcher
    (monotonic narrowing: each extra letter can only shrink the set; GIN-accelerated by the existing
    `contacts_name_trgm`). Keep **trigram only as a secondary "similar names" fallback when the
    substring result is thin** (e.g. < 5), ranked below exact-substring hits — preserving typo tolerance
    (Katherine/Catherine) without the wobble.
  - **Expansion — match across `name_normalized` ∪ `dedup_normalized` ∪ `contact_emails.email`** so a
    contact is found by first/last **and** display name **and** email (today it misses real first/last
    when a display-name override is pinned, and misses email entirely).
  - Query change only — no schema change; the needed indexes already exist. Update the existing
    trigram-behavior tests in the same change.

_Meg's door-specific requirements (match-list display, exclude-checked-in, row layout, and her
check-in considerations) live in [meg-door-checkin.md](meg-door-checkin.md)._

## 3. Search & entry (Mel's maintenance search)

- **M-R3** — Mel's maintenance search reuses the **check-in search pattern** (fuzzy, focus-to-search).
- **M-R4** — Results render in **two sections**: (a) **single contact** to select, (b) **potential
  duplicates** to review. The single list ranks on `name_normalized`; the duplicates section is the
  dedup notion (shared `dedup_normalized`) and routes into the duplicates/merge flow.

## 4. Record mode — single-contact CRUD

### 4.1 Editable scalar fields

- **M-R5** — Mel maintains: **first name, last name, display name, pronouns, phone**, and (governance-
  gated) **`is_volunteer`**. All but `is_volunteer` are plain `contact.write`.
- **M-R6 — Name control (Automatic / Custom).** One input (`display_name_override`) plus a read-only
  live preview (`display_name`). A single toggling button:

  | State | `display_name_override` | Display-name field | Button |
  |---|---|---|---|
  | **Automatic** | `null` | read-only preview, live-tracks "first last" | **Set custom name** |
  | **Custom** | non-blank | editable (the override) | **Reset to automatic** |

  - "Set custom name" prefills the field with the current effective name.
  - "Reset to automatic" clears the override to `null`; preview resumes tracking first+last.
  - A **blank custom field on save = Reset** (override → `null`), never an error.
  - Editing first/last while **Custom** does **not** move the pinned name.
  - `display_name` is always shown read-only (never a second editable name box). `name_normalized` /
    `dedup_normalized` are machinery — hidden from Mel; super_user-only diagnostic if surfaced at all.
- **M-R7 — `is_volunteer` is governance-only.** Shown on the detail view but **read-only unless the
  viewer holds `role.assign`** (President / VP / super_user). It is the staff-access gate (feature 015);
  a mailing-list manager sees the status, a VP-also-MLM edits it. No catalog change — UI gating only.
- **M-R8 — Read-only context fields.** Show `membership_status`, `needs_review`, and the volunteer
  flags (`volunteer_approved_at` / `_by`) as read-only context. **Hide `source`.** `membership_status`
  / `list_member` are materialized (from `memberships`) and never hand-edited here.

### 4.2 Delete & archive

- **M-R9 — Soft archive** (reversible), riding on `contact.write`. Requires a new
  **`contacts.archived_at`** column (mirrors `bands.archived_at`); an archived contact is _retired but
  not a duplicate_ (distinct from `merged_into_id`).
- **M-R10 — Active-read filter.** Every active-contact read (search, mailing-list exports, dedup
  candidates) filters **`merged_into_id IS NULL AND archived_at IS NULL`**; the `contacts_active`
  partial index extends to match.
- **M-R11 — Safe hard delete** via new capability **`contact.delete`** (mailing_list_manager): refuses
  when the contact has any membership / attendance / payment history (those cases must be **merged**,
  not deleted — `memberships` is `ON DELETE CASCADE`, so a hard delete would erase membership history).
- **M-R12 — Unrestricted hard delete** via new capability **`contact.delete.unrestricted`**
  (**super_user only**): bypasses the history guard. A distinct capability, not an inline
  `role === super_user` check, per the catalog's design principle.

### 4.3 Emails (listed below the contact fields)

- **M-R13 — Per-contact email list.** A contact may have several emails; each is an editable row below
  the scalar fields. Editable: **address, purposes, consent topics, status.** Gated by
  `contact.mailing.write` (now global for Mel per M-R2).
- **M-R14 — Status = Active/Inactive toggle.** `transition` is a system-managed state (provider
  migration); if a row is in it, surface it **read-only**, not on Mel's toggle.
- **M-R15 — Rules the editor must encode visibly** (today enforced only deep in service/DB):
  1. **`do_not_contact` is exclusive** — the service collapses `consent_topics` to `{do_not_contact}`.
     The UI shows this (selecting DNC clears/greys the other topics), never silently drops them.
  2. **At least one** purpose and one consent topic (validation `nonempty` + DB CHECK `≥1`) — the
     control prevents the empty state rather than erroring on save.
  3. **Cross-contact active-uniqueness collision is a duplicate signal.** Active emails are unique
     across contacts (partial unique on `lower(trim(email))` where status ∈ {active, transition}). If
     Mel corrects an address to one already active elsewhere, surface _"already active on **X** — same
     person? → Review as duplicate,"_ wiring into the dedup flow (not a raw constraint error).
  4. **A login email is the staff sign-in identity.** A row with `is_login` is how that volunteer signs
     in via Google (email→contact match), allowed only on volunteer contacts. Mark it ("used for staff
     sign-in") and guard address-change / deactivation.
- **M-R16 — Provider telemetry** (`provider_last_open` / `_last_click` / `_set_date`) shown **read-only
  on the row, provisionally.** Compact, mobile-conscious treatment (e.g. "opened 3mo ago" / dead-address
  hint, possibly tap-to-expand); revisit whether it earns its place once seen in the mobile layout.
- **M-R17 — Add / remove.** Mel can add an email. **Remove = set inactive** (soft; keeps history +
  telemetry, drops it from lists and the active-uniqueness scope). **Hard row-delete = super_user only**
  (proposed capability `contact.email.delete`; may fold under `contact.delete.unrestricted`).

### 4.4 Shared / family emails (ownership + reference)

Families often give **one email for contact tracing** covering everyone. Today the active-email
cross-contact uniqueness forbids two contacts sharing an address (it treats a shared address purely as
a dedup signal). This models legitimate sharing.

- **M-R23 — Email ownership + reference (pointer model).** An email is **owned** by exactly one contact
  (the row holding the address and any `is_login`). Another contact may **reference** that email as their
  **message recipient** via a single nullable pointer `contacts.message_recipient_email_id →
  contact_emails.id`. A referencing contact holds **no email row and no independent consent** of her own
  — she rides the owner's address for **contact tracing** only. Example: David owns `shared@jones.com`;
  Bridget points to it.
- **M-R24 — Uniqueness & sign-in unchanged (VERIFIED).** Because a reference is a **pointer on
  `contacts`, not a `contact_emails` row**, the active-email uniqueness (`contact_emails_unique_active`)
  and the feature-015 sign-in match already see **only owned rows** — so a shared address still resolves
  to exactly one contact with **no change** to the constraint or sign-in code. Confirmed in
  `src/server/auth/signIn.ts`: enrolment matches `WHERE email = … AND status = 'active'` and treats
  `> 1` match as an `ambiguous_match` invariant; the pointer model keeps that invariant true for free.
- **M-R25 — Login is owner-only (automatic, VERIFIED).** `is_login` lives on `contact_emails`, so a
  reference (a pointer, no email row) **cannot** carry it by construction. David (owner) can sign in with
  the shared address; Bridget (reference) cannot. `emailService.isLoginAllowed` additionally gates on
  `isVolunteer`. So "David can use it, but not Bridget" needs **no extra enforcement**.
- **M-R26 — Sharing is not merging.** A same-email collision now has **two** resolutions: **merge**
  (same person) or **link as shared** (different people, one household email). Mel's dedup confirms David
  as owner + Bridget as reference rather than merging; Meg's door flow gets the matching affordance
  (MEG-R5). So a same-email hit is no longer automatically a merge candidate.
- **M-R27 — Lifecycle.** When Bridget later gives her own address, replace the reference with an owned
  email row (capture then). If David's referenced email is removed/deactivated, Bridget's pointer is
  handled (SET NULL) and flagged `needs_review` to re-capture her address.

_Resolved:_

- **Consent home → pointer, no reference-row.** A referencing contact may **not** hold her own list
  subscriptions, so the single nullable pointer (M-R23) is enough — no reference-type email row.
- **Export dedup → by resolved address.** A contact-tracing export dedupes by resolved address (the
  household is reached once, both names listed); the email provider enforces dedupe regardless.

## 5. Triage mode — worklists

Two queues: **needs-review** (`needs_review = true`) and **potential duplicates** (dedup suggestions).

**`needs_review` is a completeness + provider-upload worklist**, not a duplicate signal. Every
door-created contact enters it (Meg's MEG-R4); it clears when the record is complete **and** its new
address has been uploaded/exported to the provider. Duplicate detection is a **separate automated sweep**
that feeds the duplicates queue independently — a same-email case may be a family share, not a merge
(M-R23/M-R26).

- **M-R18 — Per-row adaptive actions.** A row offers an **inline quick-action** when it is _safely
  resolvable in place_ (needs-review with complete info → **Clear review**; a suggested pair → **Not a
  duplicate** to dismiss). When the row is consequential or ambiguous (merge with field conflicts, the
  two-login collision, a too-sparse record) it offers **Open to resolve** instead. **Opening the record
  is always available** from any row.
- **M-R19 — Duplicates reuse the existing merge engine** (`dedup.write` — Mel holds it globally today;
  `mergeService` / `/dedup`). A pair opens a **merge-compare view** (not an inline phone-row merge).
- **M-R20 — Emails travel with the merge.** `mergeService` re-points **all** of the merged contact's
  emails to the survivor (union — every status, not only active) and recomputes the survivor's status.
  The merge-review screen **shows the emails per candidate and states that the survivor inherits all**.
- **M-R21 — Two `is_login` emails on merge.** The survivor can hold only one login
  (`one_login_per_contact`), so the merge cannot silently complete. If the viewer holds **`role.assign`**
  (the login/identity governance authority, consistent with M-R7), they **choose the surviving login
  inline** and the merge completes. Otherwise the merge is **held and dropped into the needs-review
  queue** for a VP/President — framed as _"resolve this person's staff identity,"_ since two logins means
  merging two volunteers (also touches `staff_identities` / role grants, not just the email). _VERIFIED:
  `mergeService` re-points all emails with **no `is_login` handling**, so two logins currently hit
  `contact_emails_one_login_per_contact` and throw a raw error — this requirement replaces that._
- **M-R22 — Cross-queue link.** A duplicates task can therefore **spawn a needs-review task** (M-R21).
  The two queues are not isolated.

## 6. Summary of implied changes

### Capability catalog (feature 016 `CAPABILITIES` map)

| Change | Detail |
|---|---|
| Add `contact.write` → `mailing_list_manager` | M-R1 |
| Flip `contact.mailing.write` `scoped` → `global` for `mailing_list_manager` | M-R2 |
| New `contact.delete` → `mailing_list_manager` (+ super_user via superset) | M-R11 |
| New `contact.delete.unrestricted` → super_user only | M-R12 |
| New `contact.email.delete` → super_user only _(may fold into `contact.delete.unrestricted`)_ | M-R17 |
| `is_volunteer` edit stays under existing `role.assign`; surviving-login choice on merge also `role.assign` | M-R7, M-R21 |

### Schema

| Change | Detail |
|---|---|
| Add `contacts.archived_at timestamptz NULL` (soft archive) | M-R9 |
| Extend active-read filter + `contacts_active` index to also require `archived_at IS NULL` | M-R10 |
| Add `contacts.message_recipient_email_id → contact_emails.id` (shared-email pointer). **No** change to `contact_emails_unique_active`, sign-in, or `is_login` — the pointer model keeps them owned-only by construction (VERIFIED) | M-R23–M-R25 |

_No email/consent schema changes — those columns already exist. `is_volunteer`, `needs_review`,
`merged_into_id`, provider telemetry, and the consent/purpose/status enums are all present today._

### Behavior / query

| Change | Detail |
|---|---|
| Mel's maintenance search: two-section results (single + duplicates) | M-R3, M-R4 |
| **Fix `searchContacts`** (substring-primary + fuzzy fallback; name ∪ dedup ∪ email) — **priority** | X-R3 |
| `mergeService` resolves the two-login case (choose or escalate) instead of hitting the constraint | M-R21 |

## 7. Open items / to detail at spec time

- **M-R16** provider telemetry is **provisional** — confirm it survives the mobile layout.
- **M-R21** the two-volunteer merge is governance-heavy: `mergeService` today re-points only emails /
  memberships / payers, **not** `staff_identities` or `role_grants`. The "resolve staff identity"
  escalation needs those relink/collision rules specified.
- Whether `contact.email.delete` is its own capability or folds into `contact.delete.unrestricted`.
- Primary-email designation (backlog **B3**) remains **out of scope**.
