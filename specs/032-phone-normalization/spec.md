# Feature Specification: Phone number normalization (store canonical, display dashed, US default)

**Feature Branch**: `032-phone-normalization`

**Created**: 2026-08-03

**Status**: Draft

**Input**: User description: "P5-R6"

## User Scenarios & Testing *(mandatory)*

A contact's phone number is entered many ways — `(585) 555-1234`, `585.555.1234`, `5855551234`. Today it is
stored exactly as typed, so the same number lives in the directory in inconsistent forms, which reads badly
and undermines matching. This feature stores every phone in **one canonical form** and displays it in a
**standard dashed** format, assuming **US (+1)** when no country code is given.

### User Story 1 - A phone entered in any format is stored consistently (Priority: P1)

Whoever captures a contact (staff in the directory, at check-in, at the gate, or a member joining online) can
type the phone however they like. On save, it is stored in **one canonical form** — the same regardless of
the punctuation, spacing, or grouping the person typed.

**Why this priority**: This is the foundation — without a single stored form, display and future matching
can't be consistent. It fixes the root cause.

**Independent Test**: Save the same number in three different punctuations → all three store the identical
canonical value.

**Acceptance Scenarios**:

1. **Given** a contact form, **When** the phone is entered as `(585) 555-1234`, `585.555.1234`, or
   `5855551234`, **Then** each stores the **same** canonical value.
2. **Given** a 10-digit number with no country code, **When** it is saved, **Then** it is stored as a US
   number (country code `+1` assumed).
3. **Given** an already-canonical value, **When** the contact is re-saved unchanged, **Then** the stored
   phone is unchanged (normalizing is idempotent).

---

### User Story 2 - Phones display in a standard dashed format (Priority: P1)

Everywhere a contact's phone is shown (directory, check-in, performers, and the dedup page), it appears in a
**standard dashed** format — e.g. `585-555-1234` — rather than the raw punctuation someone once typed.

**Why this priority**: The readable, consistent display is the visible payoff of canonical storage; it
directly serves staff scanning the directory.

**Independent Test**: A contact whose phone is stored canonically shows a dashed display (`585-555-1234`) on
every surface that renders a phone.

**Acceptance Scenarios**:

1. **Given** a US phone stored canonically, **When** it is displayed, **Then** it shows as `585-555-1234`
   (area code – prefix – line, dashed).
2. **Given** a non-US phone stored with its country code, **When** it is displayed, **Then** its country code
   is shown alongside the number (e.g. `+44 …`), not dropped.
3. **Given** a stored value that could not be normalized (kept raw), **When** it is displayed, **Then** it is
   shown exactly as stored (no mangling).

---

### User Story 3 - Existing phones are cleaned up once (Priority: P2)

The directory already holds many free-form phones. A **one-time cleanup** converts existing stored phones to
the canonical form, so the whole directory becomes consistent — not just newly entered contacts.

**Why this priority**: High value for the existing data, but it depends on US1's normalization rule and is a
one-off, so it follows the write-path fix.

**Independent Test**: Run the cleanup over a directory of mixed-format phones → every parseable phone becomes
canonical and no phone value is lost.

**Acceptance Scenarios**:

1. **Given** existing contacts with free-form phones, **When** the cleanup runs, **Then** every **parseable**
   phone is converted to the canonical form.
2. **Given** an existing phone that cannot be parsed, **When** the cleanup runs, **Then** it is **left
   unchanged** (no data loss).
3. **Given** the cleanup has already run, **When** it runs again, **Then** nothing changes (idempotent).

---

### Edge Cases

- **Unparseable input** (too few/many digits, contains letters, or an extension like `x89`): stored **as
  entered** (raw), never rejected or truncated; displayed as-is.
- **Extensions**: a number with an extension is treated as unparseable for canonical storage (kept raw) — no
  separate structured extension field is introduced.
- **Explicit non-US country code** (leading `+` and a code other than `+1`): kept canonical with that country
  code, not forced to `+1`.
- **11 digits leading with `1`** (e.g. `1-585-555-1234`): treated as the US number `+15855551234`.
- **Empty / absent phone**: remains empty; nothing to normalize or display.
- **Whitespace-only or punctuation-only input**: treated as empty (no phone).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: On saving a contact, the phone MUST be normalized to **one canonical stored form** — digits with
  a country code, assuming **US (`+1`)** when no explicit country code is given (e.g. `+15855551234`).
- **FR-002**: The stored value MUST be **independent of the input's punctuation, spacing, or grouping** — the
  same number typed different ways stores identically.
- **FR-003**: An input that **cannot be parsed** as a valid phone number (wrong digit count, letters, or an
  extension) MUST be stored **exactly as entered** (raw) — never rejected or mangled, so no information is
  lost.
- **FR-004**: A phone with an **explicit non-US country code** MUST be stored canonically **with** that
  country code (not forced to `+1`).
- **FR-005**: Wherever a contact phone is displayed, it MUST be shown in a **standard dashed format** (US:
  `585-555-1234`; non-US shown with its country code). A value kept raw (unparseable) MUST be displayed
  **as stored**.
- **FR-006**: A **one-time cleanup** MUST normalize existing stored phones to the canonical form; **unparseable**
  existing values MUST be left unchanged; the cleanup MUST be **idempotent** (re-running changes nothing).
- **FR-007**: Normalization MUST apply at **every path** that saves a contact phone (directory create/edit,
  and any capture route that creates or updates a contact), via **one shared** normalization at the write
  boundary — no route may store a raw phone for a parseable number.

### Key Entities

- **Contact**: the directory record. Its single **phone** value now holds a **canonical** form (or the raw
  input when unparseable). No new phone field is added; extensions are not separated out.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The same number entered in **at least three** different punctuations stores as **one identical**
  value.
- **SC-002**: 100% of displayed phones for parseable numbers use the **dashed** format; none show the raw
  punctuation a user happened to type.
- **SC-003**: After the cleanup, **every parseable** existing phone is canonical and **no** phone value is
  lost (unparseable ones unchanged).
- **SC-004**: Normalizing an **already-canonical** value is a **no-op** — re-saving a contact with a clean
  phone does not change it.

## Assumptions

- **Single phone field**: there is one phone per contact (`contacts.phone`); no secondary/mobile field is
  added by this feature.
- **US default**: with no country code, a **10-digit** number is assumed US (`+1`), and an **11-digit** number
  starting with `1` is treated as `+1` + the 10 digits.
- **Canonical form** is E.164-style (`+` country code + national digits, no punctuation); **display** re-adds
  standard dashes for US and a country-code prefix for non-US. Exact per-country display grouping beyond
  "country code + national number" is out of scope (best-effort).
- **Unparseable → raw**: anything that isn't a clean parseable number (wrong length, letters, extension) is
  stored and displayed exactly as entered; extensions are **not** split into a structured field (YAGNI).
- **Matching is unchanged**: this feature affects storage and display only. Dedup **matching** on phone/email
  is deferred (backlog); the dedup page's phone/email **display** is the separate P5-R7 feature and benefits
  from the canonical/dashed phone here.
- **One-time cleanup** is a backfill over existing contacts (the second Phase 5 migration, after `0029`), run
  once with a pre-run snapshot per project practice. It is idempotent.
- **No validation tightening**: the phone field stays optional; normalization never rejects a save (a bad
  value is kept raw, not blocked).
