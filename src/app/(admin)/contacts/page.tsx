"use client";
import { apiFetch } from "@/app/apiFetch";

import { useCallback, useEffect, useRef, useState } from "react";
import AdminPage from "@/app/(admin)/_components/AdminPage";
import TriageList from "@/app/(admin)/_components/TriageList";
import RecordView from "@/app/(admin)/_components/RecordView";
import styles from "./contacts.module.css";

type ContactSummary = {
  id: string;
  displayName: string;
  membershipStatus: string;
  listMember: boolean;
  pronouns: string | null;
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
  const [selected, setSelected] = useState<ContactSummary | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
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
          onOpen={(c) => setSelected(c)}
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

      {/* Record mode: the opened contact's summary (read-only here; editing is Mel's feature). */}
      {selected && (
        <section className={styles.section}>
          <RecordView
            title={selected.displayName}
            actions={
              <button type="button" className={styles.button} onClick={() => setSelected(null)}>
                Close
              </button>
            }
          >
            <dl className={styles.detail}>
              <div>
                <dt>Pronouns</dt>
                <dd>{selected.pronouns ?? "—"}</dd>
              </div>
              <div>
                <dt>Membership</dt>
                <dd>{selected.membershipStatus}</dd>
              </div>
              <div>
                <dt>On mailing list</dt>
                <dd>{selected.listMember ? "Yes" : "No"}</dd>
              </div>
            </dl>
          </RecordView>
        </section>
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
