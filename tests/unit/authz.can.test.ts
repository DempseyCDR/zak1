import { describe, expect, it } from "vitest";
import { can } from "@/server/auth/can";
import type { Grant } from "@/server/auth/actor";

/**
 * The evaluator, as a pure function (research R5 / contracts §3).
 *
 * Scope is a SET OF FILTERS (series OR group), never a tree walk (FR-007). Authority is the UNION of
 * grants and there is no deny rule (FR-004) — "Door Attendant ✗ gate" is expressed by the Door
 * Attendant's row simply not containing `gate.write`, never by a deny entry. A deny would strip gate
 * access from an FS who also works the door, which use-cases.md §5.2.8 expects to be routine.
 */

const TNC = "11111111-1111-1111-1111-111111111111";
const ECD = "22222222-2222-2222-2222-222222222222";
const THANKSGIVING = "33333333-3333-3333-3333-333333333333";

/** A bare actor: the Organizer base, no grants. */
const base: Grant[] = [];

const bookerOfEcd: Grant[] = [{ role: "booker", seriesId: ECD, groupId: null }];
const clubWidePresident: Grant[] = [{ role: "president", seriesId: null, groupId: null }];

describe("can() — the Organizer base (FR-001, FR-002)", () => {
  it("confers no write of its own", () => {
    expect(can(base, "event.write", { seriesId: ECD })).toBe(false);
    expect(can(base, "gate.write", { seriesId: TNC })).toBe(false);
    expect(can(base, "role.assign")).toBe(false);
  });

  it("is denied contact PII — the one thing the base cannot read (FR-016)", () => {
    expect(can(base, "contact.pii.read")).toBe(false);
  });
});

describe("can() — an absent target is an UNSCOPED question", () => {
  it("a scoped grant qualifies when no target is given (layer 1's question)", () => {
    // `withAuth` asks "do you hold this anywhere?" before the body is read and the target is knowable.
    // If a scoped grant answered no here, layer 1 would refuse a Booker-of-ecd on their own series.
    expect(can(bookerOfEcd, "event.write")).toBe(true);
  });

  it("...but still says no when the role lacks the capability entirely", () => {
    expect(can(bookerOfEcd, "gate.write")).toBe(false);
  });

  it("a target, once given, constrains normally", () => {
    expect(can(bookerOfEcd, "event.write", { seriesId: TNC })).toBe(false);
  });
});

describe("can() — per-series scope (FR-007, SC-002)", () => {
  it("allows the holder's own series", () => {
    expect(can(bookerOfEcd, "event.write", { seriesId: ECD })).toBe(true);
  });

  it("denies another series", () => {
    expect(can(bookerOfEcd, "event.write", { seriesId: TNC })).toBe(false);
  });

  it("denies a capability the role does not hold at all", () => {
    expect(can(bookerOfEcd, "gate.write", { seriesId: ECD })).toBe(false);
  });
});

describe("can() — club-wide scope", () => {
  it("matches any target", () => {
    expect(can(clubWidePresident, "role.assign", { seriesId: TNC })).toBe(true);
    expect(can(clubWidePresident, "role.assign")).toBe(true);
  });
});

describe("can() — group and series are ORTHOGONAL (FR-007, SC-005)", () => {
  const groupGrant: Grant[] = [{ role: "booker", seriesId: null, groupId: THANKSGIVING }];

  it("reaches an event in a series the holder has NO series grant for", () => {
    // "Thanksgiving 2026" spans tnc + ecd. This is intended, not a leak: event groups deliberately
    // cross series, so a group grant legitimately reaches both.
    expect(can(groupGrant, "event.write", { seriesId: TNC, groupId: THANKSGIVING })).toBe(true);
    expect(can(groupGrant, "event.write", { seriesId: ECD, groupId: THANKSGIVING })).toBe(true);
  });

  it("denies the same series OUTSIDE the group", () => {
    expect(can(groupGrant, "event.write", { seriesId: TNC, groupId: null })).toBe(false);
  });

  it("simply does not match an ungrouped event — no error", () => {
    expect(can(groupGrant, "event.write", { seriesId: TNC })).toBe(false);
  });
});

describe("can() — additive union, allow-wins (FR-004)", () => {
  it("holding Door Attendant does not SUBTRACT the FS's gate write", () => {
    // The hard boundary is "does not confer", never "denies". An FS who also works the door keeps
    // their gate write — use-cases.md §5.2.8 expects exactly this.
    const fsAndDoor: Grant[] = [
      { role: "financial_secretary", seriesId: TNC, groupId: null },
      { role: "door_attendant", seriesId: null, groupId: null },
    ];
    expect(can(fsAndDoor, "gate.write", { seriesId: TNC })).toBe(true);
  });

  it("a Door Attendant alone is refused the gate write at every scope (SC-003)", () => {
    const door: Grant[] = [{ role: "door_attendant", seriesId: null, groupId: null }];
    expect(can(door, "gate.write", { seriesId: TNC })).toBe(false);
    expect(can(door, "gate.write", { seriesId: ECD })).toBe(false);
    expect(can(door, "gate.write")).toBe(false);
    // ...but check-in is exactly what it is for, and it is club-wide (FR-038).
    expect(can(door, "attendance.write", { seriesId: TNC })).toBe(true);
    expect(can(door, "attendance.write", { seriesId: ECD })).toBe(true);
  });

  it("the same role at two series covers both (FR-005)", () => {
    const twoSeries: Grant[] = [
      { role: "booker", seriesId: ECD, groupId: null },
      { role: "booker", seriesId: TNC, groupId: null },
    ];
    expect(can(twoSeries, "event.write", { seriesId: ECD })).toBe(true);
    expect(can(twoSeries, "event.write", { seriesId: TNC })).toBe(true);
  });
});

describe("can() — the three supersets are flattened into the catalog (FR-009..FR-012)", () => {
  it("Treasurer holds every FS capability, on ANY series", () => {
    const treasurer: Grant[] = [{ role: "treasurer", seriesId: null, groupId: null }];
    expect(can(treasurer, "gate.write", { seriesId: TNC })).toBe(true);
    expect(can(treasurer, "gate.write", { seriesId: ECD })).toBe(true);
  });

  it("VP holds every President capability", () => {
    const vp: Grant[] = [{ role: "vice_president", seriesId: null, groupId: null }];
    expect(can(vp, "role.assign")).toBe(true);
    expect(can(vp, "club_settings.write")).toBe(true);
  });

  it("Super-user may write anything", () => {
    const su: Grant[] = [{ role: "super_user", seriesId: null, groupId: null }];
    expect(can(su, "gate.write", { seriesId: TNC })).toBe(true);
    expect(can(su, "role.assign")).toBe(true);
    expect(can(su, "contact.pii.read")).toBe(true);
    expect(can(su, "treasurer_report.write")).toBe(true);
  });

  it("a Treasurer is NOT thereby a President — the supersets are only the three", () => {
    const treasurer: Grant[] = [{ role: "treasurer", seriesId: null, groupId: null }];
    expect(can(treasurer, "role.assign")).toBe(false);
  });
});

describe("can() — scope varies per CAPABILITY, not per role (FR-008)", () => {
  const mlmOfEcd: Grant[] = [{ role: "mailing_list_manager", seriesId: ECD, groupId: null }];

  it("the MLM exports ALL series despite being scoped to one", () => {
    // The scope exception that `scopeMode: 'global'` exists for. Same grant, same holder, different
    // capability, different scope.
    expect(can(mlmOfEcd, "export.read", { seriesId: TNC })).toBe(true);
    expect(can(mlmOfEcd, "export.read", { seriesId: ECD })).toBe(true);
  });

  it("...but manages only its OWN series' mailing list", () => {
    expect(can(mlmOfEcd, "mailing_list.write", { seriesId: ECD })).toBe(true);
    expect(can(mlmOfEcd, "mailing_list.write", { seriesId: TNC })).toBe(false);
  });
});

describe("can() — PII read rides on the roles that need it (FR-016a)", () => {
  it("is conferred by a Door Attendant grant (matching a dancer)", () => {
    expect(
      can([{ role: "door_attendant", seriesId: null, groupId: null }], "contact.pii.read"),
    ).toBe(true);
  });

  it("is conferred by the Booker (performer contact details)", () => {
    expect(can([{ role: "booker", seriesId: ECD, groupId: null }], "contact.pii.read")).toBe(true);
  });

  it("is NOT conferred by the bare base — the lapsed short-term volunteer", () => {
    expect(can(base, "contact.pii.read")).toBe(false);
  });
});
