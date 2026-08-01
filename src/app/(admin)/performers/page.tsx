"use client";
import { apiFetch } from "@/app/apiFetch";

import { useCallback, useEffect, useState } from "react";

type Performer = { id: string; displayName: string; bio: string | null };

export default function PerformersPage() {
  const [items, setItems] = useState<Performer[]>([]);
  // Feature 026: capture structured names (first/last/optional display) like the directory/check-in flows.
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayNameOverride, setDisplayNameOverride] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch("/api/performers");
    const data = await res.json();
    setItems(data.items ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setWarning(null);
    const hasContactInfo = email.trim() || phone.trim();
    const res = await apiFetch("/api/performers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: firstName.trim(),
        ...(lastName.trim() ? { lastName: lastName.trim() } : {}),
        ...(displayNameOverride.trim() ? { displayNameOverride: displayNameOverride.trim() } : {}),
        ...(bio ? { bio } : {}),
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      }),
    });
    if (!res.ok) {
      setError("Failed to create performer");
      return;
    }
    if (!hasContactInfo) {
      setWarning("Performer created with no email or phone on file — flagged for follow-up.");
    }
    setFirstName("");
    setLastName("");
    setDisplayNameOverride("");
    setEmail("");
    setPhone("");
    setBio("");
    void load();
  }

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1>Performers</h1>
      <ul>
        {items.map((p) => (
          <li key={p.id}>{p.displayName}</li>
        ))}
        {items.length === 0 && <li style={{ color: "#888" }}>No performers</li>}
      </ul>
      <h2>Add performer</h2>
      <form onSubmit={create} style={{ display: "grid", gap: 6, maxWidth: 420 }}>
        <input
          placeholder="First name"
          aria-label="First name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
        <input
          placeholder="Last name (optional)"
          aria-label="Last name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />
        <input
          placeholder="Display name (optional — a stage name)"
          aria-label="Display name"
          value={displayNameOverride}
          onChange={(e) => setDisplayNameOverride(e.target.value)}
        />
        <input
          placeholder="Email (optional)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          placeholder="Phone (optional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <textarea
          placeholder="Bio (optional)"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
        <button type="submit" disabled={!firstName.trim()}>
          Create
        </button>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        {warning && <p style={{ color: "#a15c00" }}>{warning}</p>}
      </form>
    </main>
  );
}
