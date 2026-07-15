"use client";

import { useCallback, useEffect, useState } from "react";

type Performer = { id: string; displayName: string; bio: string | null };

export default function PerformersPage() {
  const [items, setItems] = useState<Performer[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/performers");
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
    const res = await fetch("/api/performers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName,
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
    setDisplayName("");
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
          placeholder="Name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
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
        <button type="submit">Create</button>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        {warning && <p style={{ color: "#a15c00" }}>{warning}</p>}
      </form>
    </main>
  );
}
