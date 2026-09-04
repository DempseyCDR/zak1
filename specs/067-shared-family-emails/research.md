# Phase 0 Research: Shared / Family Emails

All Technical Context entries resolved; no NEEDS CLARIFICATION markers remain. The four clarify answers
(2026-09-03) settled capability, export scope, list qualification, and row shape, so the research below is
about **how** to land those decisions against the existing code rather than what to build.

## R1 — Where the reference lives (and why nothing else moves)

**Decision**: A single nullable column `contacts.message_recipient_email_id uuid NULL REFERENCES
contact_emails(id) ON DELETE SET NULL`, with a partial index on the non-null values.

**Rationale**: Verified against the code during specify. `contact_emails_unique_active` is a partial unique
index over `lower(trim(email))` on **rows in `contact_emails`**; `signIn.ts` enrols by
`WHERE email = … AND status = 'active'` over the same table and treats `> 1` match as an `ambiguous_match`
invariant. A pointer on `contacts` is invisible to both, so a shared address still resolves to exactly one
owning contact with **zero** changes to the constraint or to sign-in. Likewise `is_login` is a column on
`contact_emails`; a referrer has no row, so it cannot carry a login **by construction** — M-R25 needs no
enforcement code, only a regression test.

**Alternatives considered**:

- *A second `contact_emails` row of a "reference" kind* — rejected: it would immediately collide with
  `contact_emails_unique_active` (the exact problem being solved) and would give the referrer a place to
  hold independent consent, which the source doc explicitly resolved against.
- *A `households` entity* — rejected as speculative infrastructure (Constitution II). Nothing in M-R23–M-R27
  needs a household to have its own identity, name, or lifecycle.
- *Dropping the uniqueness index and allowing duplicate active rows* — rejected: it breaks the sign-in
  invariant that makes email→contact matching unambiguous, which is the highest-risk thing in the codebase.

## R2 — Enforcing the lifecycle (FR-011, FR-012)

**Decision**: Split responsibility. The FK carries `ON DELETE SET NULL` as a **structural safety net**; the
**service layer** performs the semantic work — clearing pointers and flagging `needs_review`.

**Rationale**: The database can null a pointer but cannot set `needs_review = true`, and the deactivation
case (`status` → `inactive`) is not a delete at all, so a purely declarative solution cannot cover FR-012.
Conversely a purely procedural solution would leave a dangling pointer whenever a contact is hard-deleted,
because `contact_emails.contact_id` already cascades from `contacts`. Keeping both means no code path can
produce a pointer to a non-existent row, while the intended user-visible outcome (re-capture this person's
address) is always produced by the service.

A single helper `clearReferencesTo(db, emailId, reason)` is called from **three** places: `deleteEmail`
(hard delete), `patchEmail` (when status leaves the reachable set), and `addEmail`/`addEmailInTx` (when the
*referring* contact gains its own address, which is FR-011 — the mirror case, clearing that contact's own
pointer rather than pointers to an email).

**Alternatives considered**: a database trigger — rejected as harder to test and reason about than a service
call the integration suite already exercises, and it would still be unable to express "flag for re-capture"
as a user-facing concept.

## R3 — Resolving recipients in exports without N+1 or format drift

**Decision**: One shared SQL building block in `src/server/domain/exports/recipients.ts` that maps a contact
to its **resolved** email row — the contact's own active owned email if it has one, otherwise the email its
`message_recipient_email_id` points at — exposed as a joinable subquery/CTE. All four export paths join it
instead of joining `contact_emails` directly.

**Rationale**: There are four call sites (topic lists, `member`, `performer` in `exportService`, plus
`contactTracingService`), which clears the Constitution II bar of "three or more places" for a helper. Doing
it in SQL keeps each export a single round trip — resolution per contact in application code would be a
textbook N+1. Deduping by resolved address is then a `SELECT DISTINCT ON (resolved address)` rather than
post-processing in TypeScript, and the emitted row takes the **owner's** name because the owner is the
contact that owns the resolved row — which is exactly the shape clarify answer 4 asked for, and why the CSV
columns need no change at all.

**Important consequence discovered while reading the code**: contact tracing is **not** one of the six
`MAILING_LISTS`; it is a separate service and route (`/api/exports/contact-tracing`) driven by *attendance*.
So "all mailing-list exports" means the six lists **plus** the contact-tracing export — four query shapes,
not one. The topic lists are the interesting non-case: a referrer holds no consent topics, so it can never
pull an address onto a topic list, and topic-list output is therefore **unchanged** by this feature. Only
the contact-derived paths (`member`, `performer`, contact tracing) can gain rows.

**Alternatives considered**:

- *A database VIEW* — reasonable, but it adds a migration object to maintain and drizzle would not type it;
  a TS-level SQL fragment stays type-checked at each call site for the same query cost.
- *Resolving in TypeScript after fetching* — rejected: N+1, and it would move dedupe away from the database
  where `DISTINCT ON` does it correctly and cheaply.

## R4 — Qualification and suppression semantics (FR-010a, FR-010b)

**Decision**: Qualification is evaluated on the **referring** contact's own row, while the emitted address
and name come from the **owner**; the owner's `do_not_contact` suppresses the address unconditionally.

**Rationale**: This is clarify answer 3 applied to the actual queries. `member` filters on
`contacts.list_member`; `performer` joins `performers.contact_id`; contact tracing joins `attendance`. All
three are properties of the *contact*, so a referring contact can legitimately be the reason a household
address appears. Consent, by contrast, lives on the **email row**, which only the owner has — so
`do_not_contact` is checked once, on the resolved row, and wins over any referrer's qualification. This
also explains why topic lists cannot be pulled: their qualification *is* the owner's consent.

**Alternatives considered**: requiring both sides to qualify (option C at clarify time) — rejected by the
user in favour of the referrer's qualification counting, which is what makes the pointer worth having.

## R5 — Surfacing "link as shared" beside "merge"

**Decision**: Reuse the two existing collision surfaces rather than building a new screen — the feature-066
`EmailEditor` collision block (which already renders "already active on X" with keep-this/keep-other merge
buttons) gains a third action, and the `/dedup` pair view gains the same resolution.

**Rationale**: M-R26's requirement is that a same-address hit stops being *automatically* a merge candidate;
that is a matter of offering a second verb where the first one already lives. Feature 066 already built the
collision detection (`EMAIL_ACTIVE_ELSEWHERE` carries `error.other = { contactId, displayName }`), so the
owner's identity needed to create the pointer is already in hand at the moment of collision — no extra
lookup, no new flow.

**Alternatives considered**: a dedicated "households" management screen — rejected as speculative (nothing
asks for browsing households) and because it would move the decision away from the moment Mel actually has
the evidence in front of her.

## R6 — Authority

**Decision**: `contact.mailing.write` gates link/unlink; merge stays on `dedup.write`. **No capability
catalog change is required.**

**Rationale**: Confirmed by reading `capabilities.ts` — feature 059 already flipped
`contact.mailing.write` to `global` for `mailing_list_manager`, and `super_user` holds it via superset. The
reference determines *where a person's mail is delivered*, which is squarely the mailing-write concern
rather than a deduplication decision, so no new capability is introduced (Constitution II).
