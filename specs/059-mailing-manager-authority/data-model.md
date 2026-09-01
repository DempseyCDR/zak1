# Phase 1 Data Model: Mailing-List Manager Authority

**No database entities, schema, or migration are added or changed by this feature.** The "model" here is
the in-code **authorization catalog** (feature 016): the mapping of a role to the capabilities it confers
and at what scope.

## The changed artifact

`src/server/auth/capabilities.ts` — `CAPABILITIES: Record<Role, Partial<Record<Capability, ScopeMode>>>`.
Only the `mailing_list_manager` entry changes.

### `mailing_list_manager` capability map — before → after

| Capability | Before | After | Note |
|---|---|---|---|
| `mailing_list.write` | `scoped` | `scoped` | unchanged |
| `export.read` | `global` | `global` | unchanged |
| `contact.mailing.write` | **`scoped`** | **`global`** | **M-R2** |
| `dedup.write` | `global` | `global` | unchanged |
| `contact.pii.read` | `global` | `global` | unchanged |
| `contact.write` | *(absent)* | **`global`** | **M-R1** (new) |

### Scope-mode semantics (unchanged evaluator)

- `global` — confers the capability everywhere, regardless of the grant's own series/group scope
  (`can.ts`: `mode === "global" ⇒ allow`).
- `scoped` — honours the grant's series/group filters.
- *absent* — the role does not hold the capability; `can()` returns false.

## Validation / invariants

- The catalog is **exhaustively typed** — every `Role` must appear, and every value must be a valid
  `Capability` → `ScopeMode`. A typo or missing entry is a **compile error**, not a silent deny.
- **Additive-only**: no other role's map changes (FR-005). No capability is removed from any role.
- **Boundary by omission**: `role.assign`, contact delete/archive, `membership.write`, etc. remain
  **absent** from the `mailing_list_manager` map, so they stay refused (FR-004).

## State transitions

None. Authority is a static policy lookup; there is no lifecycle or stored state for this change. A
person gains/loses this authority exactly as they gain/lose a `mailing_list_manager` role grant (existing
`role_grants` mechanism — unchanged), evaluated live on each request.
