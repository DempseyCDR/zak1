"use client";
import { apiFetch } from "@/app/apiFetch";
import { EventSelector } from "@/app/EventSelector";

import { useCallback, useEffect, useRef, useState } from "react";

type SeriesRow = { id: string; key: string; name: string };
type Candidate = { id: string; displayName: string; membershipStatus: string; emails: string[] };
type Attendee = {
  id: string;
  contactId: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  childrenCount: number;
  isOpenBand: boolean;
};
type RosterSort = "first" | "last";
type Sibling = {
  id: string;
  eventDate: string;
  startTime: string | null;
  seriesKey: string;
  label: string | null;
};

/** The DB `time` column round-trips as HH:MM:SS; show HH:MM (feature 020 normalization). Used by the
 * correction modal's sibling-event dropdown; the event selector has its own copy. */
function toHHMM(t: string | null): string {
  if (!t) return "";
  const m = /^(\d{2}):(\d{2})/.exec(t);
  return m ? `${m[1]}:${m[2]}` : t;
}

export default function CheckinPage() {
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [eventId, setEventId] = useState<string>("");
  // Feature 028: the shared selector owns the event list; we keep the selected event's series to know whether
  // it is a community dance (open-band is community-dance only).
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // New-contact form (B34) + its inline extras (feature 025 US3).
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newDisplay, setNewDisplay] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newChildren, setNewChildren] = useState("");
  const [newComp, setNewComp] = useState(false);
  const [newGift, setNewGift] = useState(false); // feature 042 (P6-R10): gift-card redemption on the new-contact path
  const [newOpenBand, setNewOpenBand] = useState(false);

  // Anonymous / unmatched inline extras (feature 025 US3, FR-015 children on the unmatched path).
  const [unmatchedChildren, setUnmatchedChildren] = useState("");
  const [unmatchedComp, setUnmatchedComp] = useState(false);
  const [unmatchedGift, setUnmatchedGift] = useState(false);

  const [roster, setRoster] = useState<Attendee[]>([]);
  const [rosterSort, setRosterSort] = useState<RosterSort>("last");
  const [editing, setEditing] = useState<Attendee | null>(null);

  const communityDanceSeriesId = series.find((s) => s.key === "community_dance")?.id ?? null;
  const isCommunityDance = !!selectedSeriesId && selectedSeriesId === communityDanceSeriesId;

  useEffect(() => {
    void apiFetch("/api/series")
      .then((r) => r.json())
      .then((d) => setSeries(d.items ?? []));
  }, []);

  const loadRoster = useCallback(async (id: string, sort: RosterSort) => {
    if (!id) return setRoster([]);
    const res = await apiFetch(`/api/events/${id}/attendance?sort=${sort}`);
    const data = await res.json();
    setRoster(data.attendees ?? []);
  }, []);

  useEffect(() => {
    void loadRoster(eventId, rosterSort);
  }, [eventId, rosterSort, loadRoster]);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) return setCandidates([]);
    const res = await apiFetch(`/api/attendance/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setCandidates(data.items ?? []);
  }, []);

  useEffect(() => {
    void search(q);
  }, [q, search]);

  async function record(body: unknown, label: string, successNote?: string) {
    if (!eventId) return setMessage("Pick an event first");
    const res = await apiFetch(`/api/events/${eventId}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => null);
      setMessage(b?.error?.message ?? "Failed");
      return;
    }
    setMessage(successNote ?? `Recorded: ${label}`);
    // Clear the entry forms and return focus to search for the next dancer (US3, FR-016).
    setQ("");
    setCandidates([]);
    setNewFirst("");
    setNewLast("");
    setNewDisplay("");
    setNewEmail("");
    setNewPhone("");
    setNewChildren("");
    setNewComp(false);
    setNewGift(false);
    setNewOpenBand(false);
    setUnmatchedChildren("");
    setUnmatchedComp(false);
    setUnmatchedGift(false);
    searchRef.current?.focus();
    void loadRoster(eventId, rosterSort);
  }

  function recordNewContact() {
    const children = Number(newChildren) || 0;
    const label = `${newFirst} ${newLast}`.trim();
    const hasContactInfo = newEmail.trim() || newPhone.trim();
    void record(
      {
        newContact: {
          firstName: newFirst,
          ...(newLast.trim() ? { lastName: newLast.trim() } : {}),
          ...(newDisplay.trim() ? { displayNameOverride: newDisplay.trim() } : {}),
          ...(newEmail.trim() ? { email: newEmail.trim() } : {}),
          ...(newPhone.trim() ? { phone: newPhone.trim() } : {}),
        },
        ...(children > 0 ? { childrenCount: children } : {}),
        ...(newComp ? { isComp: true } : {}),
        ...(newGift ? { redeemedGiftCard: true } : {}),
        ...(isCommunityDance && newOpenBand ? { isOpenBand: true } : {}),
      },
      label,
      hasContactInfo
        ? undefined
        : `Recorded: ${label} — no email or phone on file, flagged for follow-up.`,
    );
  }

  function recordUnmatched() {
    const children = Number(unmatchedChildren) || 0;
    void record(
      {
        unmatched: true,
        ...(children > 0 ? { childrenCount: children } : {}),
        ...(unmatchedComp ? { isComp: true } : {}),
        ...(unmatchedGift ? { redeemedGiftCard: true } : {}),
      },
      "unmatched",
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1>Door check-in</h1>
      <EventSelector
        value={eventId}
        onSelect={(e) => {
          setEventId(e.id);
          setSelectedSeriesId(e.seriesId);
        }}
      />

      {message && <p>{message}</p>}

      <h2>Search</h2>
      <input
        ref={searchRef}
        placeholder="Type a name…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ padding: 8, width: "100%" }}
      />
      <ul style={{ listStyle: "none", padding: 0 }}>
        {candidates.map((c) => (
          <CandidateRow
            key={c.id}
            candidate={c}
            isCommunityDance={isCommunityDance}
            onCheckIn={(extras) => record({ contactId: c.id, ...extras }, c.displayName)}
          />
        ))}
      </ul>

      <h2>No match</h2>
      <div style={{ display: "grid", gap: 6, maxWidth: 360 }}>
        <input
          placeholder="First name"
          value={newFirst}
          onChange={(e) => setNewFirst(e.target.value)}
        />
        <input
          placeholder="Last name"
          value={newLast}
          onChange={(e) => setNewLast(e.target.value)}
        />
        <input
          placeholder={`Display name (default: ${`${newFirst} ${newLast}`.trim() || "First Last"})`}
          value={newDisplay}
          onChange={(e) => setNewDisplay(e.target.value)}
        />
        <input
          placeholder="Email (optional)"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
        />
        <input
          placeholder="Phone (optional)"
          value={newPhone}
          onChange={(e) => setNewPhone(e.target.value)}
        />
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <label>
            Children{" "}
            <input
              aria-label="Children for new contact"
              type="number"
              min={0}
              value={newChildren}
              onChange={(e) => setNewChildren(e.target.value)}
              style={{ width: 56 }}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={newComp}
              onChange={(e) => setNewComp(e.target.checked)}
            />{" "}
            Comp
          </label>
          <label>
            <input
              aria-label="Gift card for new contact"
              type="checkbox"
              checked={newGift}
              onChange={(e) => setNewGift(e.target.checked)}
            />{" "}
            Gift card
          </label>
          {isCommunityDance && (
            <label>
              <input
                type="checkbox"
                checked={newOpenBand}
                onChange={(e) => setNewOpenBand(e.target.checked)}
              />{" "}
              Open band
            </label>
          )}
        </div>
        <button onClick={recordNewContact} disabled={!newFirst.trim()}>
          Create + check in
        </button>
      </div>

      <h3>Anonymous / declined</h3>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label>
          Children{" "}
          <input
            aria-label="Children on unmatched"
            type="number"
            min={0}
            value={unmatchedChildren}
            onChange={(e) => setUnmatchedChildren(e.target.value)}
            style={{ width: 56 }}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={unmatchedComp}
            onChange={(e) => setUnmatchedComp(e.target.checked)}
          />{" "}
          Comp
        </label>
        <label>
          <input
            type="checkbox"
            checked={unmatchedGift}
            onChange={(e) => setUnmatchedGift(e.target.checked)}
          />{" "}
          Gift card
        </label>
        <button onClick={recordUnmatched} disabled={!eventId}>
          Declined / unmatched
        </button>
      </div>

      <h2>Checked in ({roster.length})</h2>
      <p style={{ margin: "4px 0" }}>
        Sort:{" "}
        <button onClick={() => setRosterSort("first")} disabled={rosterSort === "first"}>
          First name
        </button>{" "}
        <button onClick={() => setRosterSort("last")} disabled={rosterSort === "last"}>
          Last name
        </button>
      </p>
      <ol>
        {roster.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => setEditing(a)}
              title="Correct this attendance"
              style={{ textAlign: "left" }}
            >
              {a.displayName ?? "unmatched"}
              {a.childrenCount > 0 ? ` (+${a.childrenCount})` : ""}
              {a.isOpenBand ? " — open band" : ""}
            </button>
          </li>
        ))}
      </ol>

      {editing && (
        <CorrectionModal
          attendee={editing}
          eventId={eventId}
          isCommunityDance={isCommunityDance}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            void loadRoster(eventId, rosterSort);
          }}
        />
      )}
    </main>
  );
}

type PersonExtras = {
  childrenCount?: number;
  isComp?: boolean;
  redeemedGiftCard?: boolean; // feature 042 (P6-R10): gift-card redemption on the matched path
  isOpenBand?: boolean;
};

function CandidateRow({
  candidate,
  isCommunityDance,
  onCheckIn,
}: {
  candidate: Candidate;
  isCommunityDance: boolean;
  onCheckIn: (extras: PersonExtras) => void;
}) {
  const [children, setChildren] = useState("");
  const [comp, setComp] = useState(false);
  const [gift, setGift] = useState(false); // feature 042 (P6-R10)
  const [openBand, setOpenBand] = useState(false);

  function checkIn() {
    const n = Number(children) || 0;
    onCheckIn({
      ...(n > 0 ? { childrenCount: n } : {}),
      ...(comp ? { isComp: true } : {}),
      ...(gift ? { redeemedGiftCard: true } : {}),
      ...(isCommunityDance && openBand ? { isOpenBand: true } : {}),
    });
  }

  return (
    <li
      style={{ display: "flex", gap: 10, alignItems: "center", padding: "4px 0", flexWrap: "wrap" }}
    >
      <span>{candidate.displayName}</span>
      <small>({candidate.emails.join(", ") || "no email"})</small>
      <label>
        Children{" "}
        <input
          aria-label="Children"
          type="number"
          min={0}
          value={children}
          onChange={(e) => setChildren(e.target.value)}
          style={{ width: 56 }}
        />
      </label>
      <label>
        <input
          aria-label="Comp"
          type="checkbox"
          checked={comp}
          onChange={(e) => setComp(e.target.checked)}
        />{" "}
        Comp
      </label>
      <label>
        <input
          aria-label="Gift card"
          type="checkbox"
          checked={gift}
          onChange={(e) => setGift(e.target.checked)}
        />{" "}
        Gift card
      </label>
      {isCommunityDance && (
        <label>
          <input
            aria-label="Open band"
            type="checkbox"
            checked={openBand}
            onChange={(e) => setOpenBand(e.target.checked)}
          />{" "}
          Open band
        </label>
      )}
      <button onClick={checkIn}>Check in</button>
    </li>
  );
}

function CorrectionModal({
  attendee,
  eventId,
  isCommunityDance,
  onClose,
  onDone,
}: {
  attendee: Attendee;
  eventId: string;
  isCommunityDance: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [children, setChildren] = useState(String(attendee.childrenCount));
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [siblings, setSiblings] = useState<Sibling[]>([]);
  const [moveTo, setMoveTo] = useState("");
  const [reassignQ, setReassignQ] = useState("");
  const [reassignHits, setReassignHits] = useState<{ id: string; displayName: string }[]>([]);

  useEffect(() => {
    void apiFetch(`/api/events/${eventId}/group-siblings`)
      .then((r) => r.json())
      .then((d) => setSiblings(d.items ?? []));
  }, [eventId]);

  async function call(input: RequestInfo, init: RequestInit, close: boolean): Promise<void> {
    setError(null);
    const res = await apiFetch(input, init);
    if (!res.ok) {
      const b = await res.json().catch(() => null);
      setError(b?.error?.message ?? "Could not apply the correction");
      return;
    }
    if (close) onDone();
  }

  const patch = (body: unknown, close = true) =>
    call(
      `/api/attendance/${attendee.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      close,
    );

  async function reassignSearch(v: string) {
    setReassignQ(v);
    if (v.trim().length < 1) return setReassignHits([]);
    const res = await apiFetch(`/api/attendance/search?q=${encodeURIComponent(v)}`);
    setReassignHits((await res.json()).items ?? []);
  }

  async function doorCount(count: "comp" | "gift", delta: 1 | -1) {
    setError(null);
    setNote(null);
    const res = await apiFetch(`/api/events/${eventId}/door-count`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count, delta }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => null);
      return setError(b?.error?.message ?? "Could not adjust the count");
    }
    setNote(`${count === "comp" ? "Comp" : "Gift-card"} count ${delta > 0 ? "+1" : "−1"}.`);
  }

  const name = attendee.displayName ?? "unmatched";

  return (
    <div
      role="dialog"
      aria-label="Correct attendance"
      style={{ border: "1px solid #ccc", padding: 16, marginTop: 12, maxWidth: 460 }}
    >
      <h3>Correct: {name}</h3>
      {error && (
        <p role="alert" style={{ color: "#b00020" }}>
          {error}
        </p>
      )}
      {note && <p style={{ color: "#2e7d32" }}>{note}</p>}

      <div style={{ display: "grid", gap: 8 }}>
        <div>
          <label>
            Children{" "}
            <input
              aria-label="Edit children"
              type="number"
              min={0}
              value={children}
              onChange={(e) => setChildren(e.target.value)}
              style={{ width: 56 }}
            />
          </label>{" "}
          <button onClick={() => void patch({ childrenCount: Number(children) || 0 })}>
            Save children
          </button>
        </div>

        <label>
          <input
            aria-label="Open band"
            type="checkbox"
            checked={attendee.isOpenBand}
            disabled={!isCommunityDance && !attendee.isOpenBand}
            onChange={(e) => void patch({ isOpenBand: e.target.checked })}
          />{" "}
          Open-band musician
        </label>

        <div>
          Comp: <button onClick={() => void doorCount("comp", 1)}>Comp +1</button>{" "}
          <button onClick={() => void doorCount("comp", -1)}>Comp -1</button>
          {"  "}Gift: <button onClick={() => void doorCount("gift", 1)}>Gift +1</button>{" "}
          <button onClick={() => void doorCount("gift", -1)}>Gift -1</button>
        </div>

        {siblings.length > 0 && (
          <div>
            <label>
              Move to{" "}
              <select
                aria-label="Move to"
                value={moveTo}
                onChange={(e) => setMoveTo(e.target.value)}
              >
                <option value="">— sibling event —</option>
                {siblings.map((s) => (
                  <option key={s.id} value={s.id}>
                    {[s.eventDate, toHHMM(s.startTime), s.seriesKey, s.label]
                      .filter(Boolean)
                      .join(" · ")}
                  </option>
                ))}
              </select>
            </label>{" "}
            <button disabled={!moveTo} onClick={() => void patch({ eventId: moveTo })}>
              Move
            </button>
          </div>
        )}

        {attendee.contactId === null && (
          <div>
            <label>
              Reassign to{" "}
              <input
                aria-label="Reassign to"
                value={reassignQ}
                onChange={(e) => void reassignSearch(e.target.value)}
              />
            </label>
            <ul style={{ listStyle: "none", padding: 0 }}>
              {reassignHits.map((h) => (
                <li key={h.id}>
                  <button onClick={() => void patch({ contactId: h.id })}>
                    Assign {h.displayName}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button
            onClick={() => void call(`/api/attendance/${attendee.id}`, { method: "DELETE" }, true)}
          >
            Delete attendance
          </button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
