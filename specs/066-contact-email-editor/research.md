# Research: Contact Email Editor

Phase 0 decisions. Spec clarifications were resolved in `/speckit-clarify`; no `NEEDS CLARIFICATION`
remain. Notes record the load-bearing choices and the existing code they build on.

## D0 — what already exists (so the feature is mostly UI)

- `contact_emails`: `email` (citext), `purposes[]`, `consent_topics[]`, `status`
  (active/transition/inactive), `is_login`, and provider telemetry (`provider_set_date`,
  `provider_last_open`, `provider_last_click`).
- `emailService`: `addEmail`/`addEmailInTx` and `patchEmail` already enforce **DNC-exclusive**
  (`effectiveConsentTopics`, on both add and patch), **uniqueSet** purposes, **login-only-on-volunteer**
  (`isLoginAllowed`), and reject a cross-contact active collision (`UNIQUE_VIOLATION` →
  `emailDuplicate()`). Zod (`emailAddSchema` / `emailPatchSchema`) requires ≥1 purpose and ≥1 topic and
  forbids writing provider fields (`noProviderFields`).
- Endpoints: `POST /api/contacts/[id]/emails` (add) and `PATCH …/emails/[emailId]` (edit), both
  `contact.mailing.write`. `getContact` returns the full email rows, so the 063 editor's record GET
  already carries everything (for a PII holder).

So FR-003 (DNC-exclusive) and FR-004 (≥1 purpose/topic) are already server-enforced; this feature makes
them **visible** and adds the pieces below.

## D1 — editable address on patch

- **Decision**: Add `email` (a validated address) to `emailPatchSchema` and set it in `patchEmail`.
- **Rationale**: `patchEmail` today updates purposes/topics/status/is_login but **not the address**, yet
  FR-002 requires editing the address and FR-009's collision is precisely "correcting an address." The
  active-uniqueness constraint already covers the new address.

## D2 — collision becomes a dedup signal (FR-009)

- **Decision**: In the standalone `addEmail`/`patchEmail`, do a **pre-write lookup** — before the
  insert/update, query for an active/transition email with the same normalized address on **another**
  contact; if found, throw a **new `emailActiveElsewhere({ contactId, displayName })`** (code
  `EMAIL_ACTIVE_ELSEWHERE`, 409), changing nothing. Keep the `UNIQUE_VIOLATION` `try/catch` as a fallback
  (`emailDuplicate`). The editor shows *"already active on [name] — review as duplicate"* and a **Review
  as duplicate** action that opens the merge for the two contacts (current + colliding) via
  `POST /api/dedup/merge`, letting Mel choose which survives (keep-this / keep-other).
- **Why a pre-write lookup, not catch-then-lookup (F1)**: a post-violation lookup works for the standalone
  paths but **not** for `addEmailInTx` (inside `createContact`'s transaction) — the transaction is
  aborted after the violation, so a follow-up query fails. The pre-write check is transaction-safe and is
  the email editor's path anyway; `addEmailInTx`/create is left as-is.
- **Rationale**: a colliding active address is almost always the same person entered twice; naming the
  other contact and routing into the existing merge flow is the useful outcome (M-R15.3), not a dead-end
  error. The lookup is a small query on the same normalized key the constraint uses.
- **Alternatives**: keep the bare 409 (rejected — no dedup wiring); auto-open the merge without asking
  (rejected at clarify — the editor offers it, Mel decides).

## D3 — hard delete (FR-008), soft remove (FR-007)

- **Decision**: Soft "remove" is just `PATCH …/emails/[emailId] { status: "inactive" }` (no new
  endpoint). A **hard delete** is a new `DELETE /api/contacts/[id]/emails/[emailId]` requiring
  **`contact.delete.unrestricted`** (clarification: fold under the existing super-user capability, no new
  one) → `deleteEmail(contactId, emailId)` permanently removes the row and writes an `email.deleted`
  audit event.
- **Rationale**: soft-remove keeps history + telemetry and drops the row from the active-uniqueness
  scope; the rare permanent erasure is the super-user's, mirroring 065 and audited for observability.

## D4 — status toggle + transition read-only (FR-005)

- **Decision**: The row shows an **Active / Inactive** toggle; when the status is **transition**
  (provider-managed), the status is rendered **read-only** and the editor does not send a status change
  for it.
- **Rationale**: transition is system-managed (provider migration); Mel's toggle is Active↔Inactive only.
  UI-gated; the server keeps accepting `status` for the non-transition paths.

## D5 — login email marked + confirmed (FR-010)

- **Decision**: A row with `is_login` is marked "used for staff sign-in"; changing its **address** or
  setting it **inactive** requires an explicit client **confirmation** (clarification A) before the
  request is sent. The server keeps enforcing login-only-on-volunteer.
- **Rationale**: a login email is load-bearing for staff access; a confirmation prevents the accident
  while allowing the deliberate change (not an outright block).

## D6 — telemetry read-only (FR-011) + capability surfacing

- **Decision**: Render a compact, read-only telemetry hint per row (e.g. "opened ~3mo ago" /
  dead-address) from the provider fields already on the row; never editable (`noProviderFields` already
  forbids writing them). Add **`contactMailingWrite`** to `GET /api/me/capabilities` so the editor shows
  the email-edit controls only to holders (the server still enforces on every write).
- **Rationale**: the data is already fetched; rendering it is cheap (clarification: in scope now,
  minimal). The capability flag mirrors the 065 pattern for UI gating.

## D7 — UI lives in a dedicated component

- **Decision**: A `EmailEditor` client component rendered inside the 063 record modal, given the record's
  emails + contactId + capability flags + an `onChanged` callback (re-fetch the record after a write).
- **Rationale**: `page.tsx` is already large; a component keeps the email rows (multi-selects, toggles,
  guards, telemetry) cohesive and independently testable.
