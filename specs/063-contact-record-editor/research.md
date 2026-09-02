# Research: Contact Record Editor — Scalar Fields

Phase 0 findings. All spec clarifications were resolved in `/speckit-clarify`; the notes below record
the load-bearing decisions and the existing code they build on. No `NEEDS CLARIFICATION` remain.

## D1 — Where to enforce the `is_volunteer` gate

- **Decision**: Enforce at the **PATCH route** (`src/app/api/contacts/[id]/route.ts`): compute
  `actorCan(ctx.actor, "role.assign")`; when false, remove `isVolunteer` from the parsed input before
  calling `patchContact`. The service signature is unchanged.
- **Rationale**: `patchContact`'s only non-test caller is this route, and stripping the field yields
  exactly the clarified behavior — the other scalar edits save, the stored `is_volunteer` is left at
  `existing.isVolunteer`, and the request returns 200 (no 403, no whole-request failure). Keeps the
  domain service a pure data operation and avoids a signature change that would touch unrelated
  service-level tests (`contactNames`, `contact.phoneNormalize`).
- **Alternatives considered**:
  - *Add `canAssignRoles` param to `patchContact`* — more explicit domain enforcement, but churns the
    signature and two existing test files for no behavioral gain; rejected on YAGNI.
  - *Return 403 on a disallowed change* — rejected by clarification (silently ignore, not reject).
  - *New capability for the volunteer flag* — the spec says reuse `role.assign`; no catalog change.

## D2 — `is_volunteer` is read-only in the editor (superseded the capabilities plan)

- **Decision (revised 2026-09-01)**: The editor shows `is_volunteer` **read-only for everyone** and never
  sends it; volunteer designate/clear stays on the **access screen**. No client capability check is
  added.
- **Rationale**: The access screen already owns `is_volunteer` through `designateVolunteer` /
  `clearVolunteer` (grantService), which carry the governance-complete semantics: clearing **cascades a
  revoke of all the contact's role grants** (FR-028b) and approval is recorded separately. An in-editor
  toggle writing the flag bare via `patchContact` would bypass both — especially dangerous on *clear*,
  which would leave a non-volunteer holding grants (violating the grant-requires-volunteer invariant).
  Making the flag read-only here keeps a single, safe write path.
- **Superseded**: an earlier draft extended `GET /api/me/capabilities` with `roleAssign` to gate an
  editable toggle. That field and its test were reverted; the endpoint keeps its original two fields.
- **Retained**: the D1 endpoint guard still strips `is_volunteer` for callers without `role.assign` —
  independent defense, because `contact.write` is broadly held (door attendant at check-in).

## D3 — Populating the editor: full-record fetch on open

- **Decision**: When a search row is opened, fetch `GET /api/contacts/:id` to populate the editor. The
  search summary (`ContactSummary`) carries only id/displayName/membershipStatus/listMember/pronouns —
  not `phone`, `isVolunteer`, `needsReview`, `volunteerApprovedAt/_by`, or `displayNameOverride`.
- **Rationale**: `getContact` returns the full `ContactRow` (+ emails). Mel (`mailing_list_manager`)
  holds `contact.pii.read`, so the read returns unprojected phone; a non-PII viewer gets `phone: null`
  via `projectContact` (unchanged 016 behavior). One fetch fills every field the record needs.
- **Alternatives considered**: widening the search projection to carry all fields — rejected; it would
  bloat the per-keystroke search payload for data only the open record needs.

## D4 — Automatic / Custom display-name control

- **Decision**: One override input + a read-only live preview of the effective name + one toggling
  button (**Set custom name** ⇄ **Reset to automatic**), backed by `patchContact`'s existing
  null-override semantics: sending `displayNameOverride: null` (or a blank that the schema/service treat
  as reset) returns the contact to Automatic; a non-blank override pins Custom.
- **Rationale**: `contactPatchSchema` already types `displayNameOverride` as
  `string().trim().min(1).nullable().optional()` and `patchContact` recomputes `display_name` /
  `name_normalized` / `dedup_normalized` from override-or-"first last". The control is a thin client
  state machine over behavior the server already implements (proven by `contactNames.test.ts`).
- **Client rule**: while **Custom**, editing first/last updates the preview's *underlying* parts but must
  not overwrite the pinned override; only an explicit Reset (button or blank-on-save) clears it.

## D5 — Read-only context block

- **Decision**: Render `membership_status`, `needs_review`, `volunteer_approved_at`,
  `volunteer_approved_by` as read-only; do not render `source`; offer no membership/list-member editor.
- **Rationale**: All fields are already on the record read. `membership_status` / `list_member` are
  materialized from `memberships` and must never be hand-edited here (M-R8).

## D6 — Commit model

- **Decision**: One explicit **Save** button submitting all scalar fields in a single `PATCH`, plus a
  **Cancel/Close** that discards uncommitted edits (clarification). No autosave, no per-field commit.
- **Rationale**: Matches the sibling "Add contact" create form on the same page and gives one clean
  validation moment (blank-first-name prevented by the control; blank custom-name → reset, never error).
