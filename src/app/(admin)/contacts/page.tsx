"use client";
import { apiFetch } from "@/app/apiFetch";

import { useCallback, useEffect, useRef, useState } from "react";
import AdminPage from "@/app/(admin)/_components/AdminPage";
import TriageList from "@/app/(admin)/_components/TriageList";
import RecordView from "@/app/(admin)/_components/RecordView";
import { formatPhone } from "@/server/domain/contacts/phone";
import styles from "./contacts.module.css";

type ContactSummary = {
  id: string;
  displayName: string;
  membershipStatus: string;
  listMember: boolean;
  pronouns: string | null;
};

// Feature 063 (M-R5..M-R8): the full record behind an opened contact, fed by GET /api/contacts/:id.
type EditorRecord = {
  id: string;
  firstName: string;
  lastName: string | null;
  displayName: string;
  displayNameOverride: string | null;
  pronouns: string | null;
  phone: string | null;
  isVolunteer: boolean;
  membershipStatus: string;
  listMember: boolean;
  needsReview: boolean;
  volunteerApprovedAt: string | null;
  volunteerApprovedBy: string | null;
};

// Feature 062 (M-R4): a likely-duplicate pair from the dedup engine (shape of MergeSuggestion).
type DupContact = { id: string; displayName: string };
type DupPair = { a: DupContact; b: DupContact; similarity: number };

const PURPOSES = ["personal", "booking", "public_profile", "other"] as const;
const TOPICS = [
  "contra",
  "english",
  "openband",
  "special_events",
  "jane_austen_ball",
  "contact_tracing",
  "do_not_contact",
] as const;

export default function ContactsPage() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<ContactSummary[]>([]);
  const [searchTruncated, setSearchTruncated] = useState(false);
  const [dupPairs, setDupPairs] = useState<DupPair[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  // Feature 063: the opened record editor. `eOverride === ""` means Automatic (no custom name).
  const [record, setRecord] = useState<EditorRecord | null>(null);
  const [eFirst, setEFirst] = useState("");
  const [eLast, setELast] = useState("");
  const [eOverride, setEOverride] = useState("");
  const [ePronouns, setEPronouns] = useState("");
  const [ePhone, setEPhone] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayNameOverride, setDisplayNameOverride] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [purposes, setPurposes] = useState<string[]>(["personal"]); // FR-002a default
  const [topics, setTopics] = useState<string[]>(["contact_tracing"]); // consent default
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const search = useCallback(async (query: string) => {
    const res = await apiFetch(`/api/contacts?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setItems(data.items ?? []);
    setSearchTruncated(!!data.truncated);
    // Feature 062 (M-R4): the potential-duplicates section — query-scoped, or the global queue when empty.
    const dres = await apiFetch(`/api/dedup/suggestions?q=${encodeURIComponent(query)}`);
    const ddata = await dres.json();
    setDupPairs(ddata.pairs ?? []);
  }, []);

  useEffect(() => {
    void search(q);
  }, [q, search]);

  // Feature 062 (M-R3): focus-to-search — ready to type on load.
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  async function openRecord(id: string) {
    const res = await apiFetch(`/api/contacts/${id}`);
    if (!res.ok) return;
    const r = (await res.json()) as EditorRecord;
    setRecord(r);
    setEFirst(r.firstName);
    setELast(r.lastName ?? "");
    setEOverride(r.displayNameOverride ?? "");
    setEPronouns(r.pronouns ?? "");
    // Show the human-readable form (FR-019); Save re-canonicalizes via the endpoint's normalizePhone.
    setEPhone(r.phone ? formatPhone(r.phone) : "");
    setSaveError(null);
  }

  function closeRecord() {
    setRecord(null);
    searchRef.current?.focus(); // return focus to search (FR-020)
  }

  // Move focus into the modal when a record opens (FR-020).
  useEffect(() => {
    if (record) firstFieldRef.current?.focus();
  }, [record]);

  async function saveRecord(e: React.FormEvent) {
    e.preventDefault();
    if (!record) return;
    setSaveError(null);
    if (!eFirst.trim()) {
      setSaveError("First name is required.");
      return;
    }
    // Automatic (blank) → override null (reset, never an error, M-R6); non-blank → the pinned name.
    const body: Record<string, unknown> = {
      firstName: eFirst.trim(),
      lastName: eLast.trim() ? eLast.trim() : null,
      displayNameOverride: eOverride.trim() ? eOverride.trim() : null,
      pronouns: ePronouns.trim() ? ePronouns.trim() : null,
      phone: ePhone.trim() ? ePhone.trim() : null,
    };
    // is_volunteer is NOT edited here (M-R7 / feature 063). It is the staff-access gate whose
    // designate/clear (with grant-cascade + approval) lives on the access screen; the editor shows it
    // read-only. The PATCH route also refuses is_volunteer without role.assign as endpoint defense.
    const res = await apiFetch(`/api/contacts/${record.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => null);
      setSaveError(b?.error?.message ?? "Failed to save contact");
      return;
    }
    setRecord(null);
    void search(q);
    searchRef.current?.focus();
  }

  async function merge(canonicalId: string, mergedId: string) {
    const res = await apiFetch("/api/dedup/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canonicalId, mergedId }),
    });
    if (res.ok) {
      void search(q);
      searchRef.current?.focus(); // refocus after the action
    }
  }

  async function createContact(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setWarning(null);
    const hasContactInfo = address.trim() || phone.trim();
    const res = await apiFetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName,
        ...(lastName.trim() ? { lastName: lastName.trim() } : {}),
        ...(displayNameOverride.trim() ? { displayNameOverride: displayNameOverride.trim() } : {}),
        ...(pronouns.trim() ? { pronouns: pronouns.trim() } : {}),
        ...(address.trim() ? { email: { address, purposes, consentTopics: topics } } : {}),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? "Failed to create contact");
      return;
    }
    if (!hasContactInfo) {
      setWarning("Contact created with no email or phone on file — flagged for follow-up.");
    }
    setFirstName("");
    setLastName("");
    setDisplayNameOverride("");
    setPronouns("");
    setAddress("");
    setPhone("");
    setPurposes(["personal"]);
    setTopics(["contact_tracing"]);
    void search(q);
  }

  function toggle(list: string[], value: string, set: (v: string[]) => void) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  return (
    <AdminPage title="Contacts">
      {/* Triage mode: search results as a worklist; a row opens the record (FR-006/FR-007). */}
      <section className={styles.section}>
        <input
          ref={searchRef}
          className={styles.search}
          placeholder="Search by name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <TriageList
          items={items}
          getKey={(c) => c.id}
          onOpen={(c) => void openRecord(c.id)}
          renderRow={(c) => (
            <span className={styles.rowText}>
              <span className={styles.rowName}>
                {c.displayName}
                {c.pronouns ? ` (${c.pronouns})` : ""}
              </span>
              <span className={styles.rowMeta}>{c.membershipStatus}</span>
            </span>
          )}
          emptyState={<span className={styles.empty}>No contacts</span>}
        />
        {searchTruncated && (
          <p className={styles.hint}>More matches — refine your search to narrow the list.</p>
        )}
      </section>

      {/* Feature 062 (M-R4): potential duplicates — candidate pairs, each routing to the merge flow. */}
      {dupPairs.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.h2}>Potential duplicates</h2>
          <ul className={styles.dupList}>
            {dupPairs.map((p) => (
              <li key={`${p.a.id}-${p.b.id}`} className={styles.dupRow}>
                <span className={styles.dupPair}>
                  {p.a.displayName} ↔ {p.b.displayName}
                </span>
                <span className={styles.dupActions}>
                  <button
                    type="button"
                    className={styles.dupButton}
                    onClick={() => merge(p.a.id, p.b.id)}
                  >
                    Keep {p.a.displayName}
                  </button>
                  <button
                    type="button"
                    className={styles.dupButton}
                    onClick={() => merge(p.b.id, p.a.id)}
                  >
                    Keep {p.b.displayName}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Record mode: the opened contact — editable scalar fields (M-R5/M-R6), gated volunteer flag
          (M-R7), and read-only standing (M-R8). One Save commits all fields; Cancel discards. */}
      {record && (
        <div className={styles.backdrop}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={record.displayName}
            className={styles.modalPanel}
            onKeyDown={(e) => {
              if (e.key === "Escape") closeRecord();
            }}
          >
            <RecordView
              title={record.displayName}
              actions={
                <button type="button" className={styles.button} onClick={closeRecord}>
                  Cancel
                </button>
              }
            >
              <form onSubmit={saveRecord} className={styles.form}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>First name</span>
                  <input
                    ref={firstFieldRef}
                    className={styles.input}
                    value={eFirst}
                    onChange={(e) => setEFirst(e.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Last name</span>
                  <input
                    className={styles.input}
                    value={eLast}
                    onChange={(e) => setELast(e.target.value)}
                  />
                </label>
                {/* Automatic / Custom display name (M-R6). Automatic = blank override: the field is a
                  read-only live preview of "first last". Custom = a pinned override the editor may edit;
                  editing first/last does NOT move it. One button toggles between the two. */}
                {(() => {
                  const isCustom = eOverride.trim() !== "";
                  const autoName = `${eFirst.trim()} ${eLast.trim()}`.trim();
                  return (
                    <div className={styles.field}>
                      <label className={styles.fieldLabel} htmlFor="edit-display-name">
                        Display name
                      </label>
                      <div className={styles.nameControl}>
                        <input
                          id="edit-display-name"
                          className={styles.input}
                          value={isCustom ? eOverride : autoName}
                          readOnly={!isCustom}
                          onChange={(e) => setEOverride(e.target.value)}
                        />
                        <button
                          type="button"
                          className={styles.button}
                          onClick={() => setEOverride(isCustom ? "" : autoName)}
                        >
                          {isCustom ? "Reset to automatic" : "Set custom name"}
                        </button>
                      </div>
                    </div>
                  );
                })()}
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Pronouns</span>
                  <input
                    className={styles.input}
                    value={ePronouns}
                    onChange={(e) => setEPronouns(e.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Phone</span>
                  <input
                    className={styles.input}
                    value={ePhone}
                    onChange={(e) => setEPhone(e.target.value)}
                  />
                </label>
                <button type="submit" className={styles.button}>
                  Save
                </button>
                {saveError && <p className={styles.error}>{saveError}</p>}
              </form>
              {/* Read-only standing (M-R8): materialized/machine-managed context, never hand-edited here.
                `is_volunteer` is governance-owned (designate/clear on the access screen); `source` is
                deliberately not shown. Yes/no flags collapse into one wrapping row so a boolean does not
                cost a full stacked row of height. */}
              <div className={styles.flags}>
                <span className={styles.flag}>
                  Volunteer: <strong>{record.isVolunteer ? "Yes" : "No"}</strong>
                </span>
                <span className={styles.flag}>
                  On mailing list: <strong>{record.listMember ? "Yes" : "No"}</strong>
                </span>
                <span className={styles.flag}>
                  Needs review: <strong>{record.needsReview ? "Yes" : "No"}</strong>
                </span>
              </div>
              <dl className={styles.context}>
                <div>
                  <dt>Membership</dt>
                  <dd>{record.membershipStatus}</dd>
                </div>
                <div>
                  <dt>Volunteer approved</dt>
                  <dd>
                    {record.volunteerApprovedAt
                      ? `${record.volunteerApprovedAt}${
                          record.volunteerApprovedBy ? ` (by ${record.volunteerApprovedBy})` : ""
                        }`
                      : "—"}
                  </dd>
                </div>
              </dl>
            </RecordView>
          </div>
        </div>
      )}

      <section className={styles.section}>
        <h2 className={styles.h2}>Add contact</h2>
        <form onSubmit={createContact} className={styles.form}>
          <input
            className={styles.input}
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <input
            className={styles.input}
            placeholder="Last name (optional)"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
          <input
            className={styles.input}
            placeholder="Display name override (optional)"
            value={displayNameOverride}
            onChange={(e) => setDisplayNameOverride(e.target.value)}
          />
          <input
            className={styles.input}
            placeholder="Pronouns (optional)"
            value={pronouns}
            onChange={(e) => setPronouns(e.target.value)}
          />
          <input
            className={styles.input}
            placeholder="Email address (optional)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <input
            className={styles.input}
            placeholder="Phone (optional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <fieldset className={styles.fieldset}>
            <legend>Purposes</legend>
            {PURPOSES.map((p) => (
              <label key={p} className={styles.check}>
                <input
                  type="checkbox"
                  checked={purposes.includes(p)}
                  onChange={() => toggle(purposes, p, setPurposes)}
                />{" "}
                {p}
              </label>
            ))}
          </fieldset>
          <fieldset className={styles.fieldset}>
            <legend>Consent topics</legend>
            {TOPICS.map((t) => (
              <label key={t} className={styles.check}>
                <input
                  type="checkbox"
                  checked={topics.includes(t)}
                  onChange={() => toggle(topics, t, setTopics)}
                />{" "}
                {t}
              </label>
            ))}
          </fieldset>
          <button type="submit" className={styles.button}>
            Create
          </button>
          {error && <p className={styles.error}>{error}</p>}
          {warning && <p className={styles.warning}>{warning}</p>}
        </form>
      </section>
    </AdminPage>
  );
}
