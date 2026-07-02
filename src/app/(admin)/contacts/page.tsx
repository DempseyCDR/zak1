"use client";

import { useCallback, useEffect, useState } from "react";

type ContactSummary = {
  id: string;
  displayName: string;
  membershipStatus: string;
  listMember: boolean;
};

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
  const [displayName, setDisplayName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [purposes, setPurposes] = useState<string[]>(["personal"]); // FR-002a default
  const [topics, setTopics] = useState<string[]>(["contact_tracing"]); // consent default
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const search = useCallback(async (query: string) => {
    const res = await fetch(`/api/contacts?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setItems(data.items ?? []);
  }, []);

  useEffect(() => {
    void search(q);
  }, [q, search]);

  async function createContact(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setWarning(null);
    const hasContactInfo = address.trim() || phone.trim();
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName,
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
    setDisplayName("");
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
    <main style={{ padding: 24, maxWidth: 800 }}>
      <h1>Contacts</h1>

      <section style={{ marginBottom: 24 }}>
        <input
          placeholder="Search by name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ padding: 8, width: "100%" }}
        />
        <ul>
          {items.map((c) => (
            <li key={c.id}>
              {c.displayName} — <em>{c.membershipStatus}</em>
            </li>
          ))}
          {items.length === 0 && <li style={{ color: "#888" }}>No contacts</li>}
        </ul>
      </section>

      <section>
        <h2>Add contact</h2>
        <form onSubmit={createContact} style={{ display: "grid", gap: 8 }}>
          <input
            placeholder="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            style={{ padding: 8 }}
          />
          <input
            placeholder="Email address (optional)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            style={{ padding: 8 }}
          />
          <input
            placeholder="Phone (optional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ padding: 8 }}
          />
          <fieldset>
            <legend>Purposes</legend>
            {PURPOSES.map((p) => (
              <label key={p} style={{ marginRight: 12 }}>
                <input
                  type="checkbox"
                  checked={purposes.includes(p)}
                  onChange={() => toggle(purposes, p, setPurposes)}
                />{" "}
                {p}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Consent topics</legend>
            {TOPICS.map((t) => (
              <label key={t} style={{ marginRight: 12 }}>
                <input
                  type="checkbox"
                  checked={topics.includes(t)}
                  onChange={() => toggle(topics, t, setTopics)}
                />{" "}
                {t}
              </label>
            ))}
          </fieldset>
          <button type="submit" style={{ padding: 8 }}>
            Create
          </button>
          {error && <p style={{ color: "crimson" }}>{error}</p>}
          {warning && <p style={{ color: "#a15c00" }}>{warning}</p>}
        </form>
      </section>
    </main>
  );
}
