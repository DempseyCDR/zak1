"use client";

import { useState } from "react";

/**
 * A minimal search-and-pick for a contact (feature 016).
 *
 * The general principle (BACKLOG B39): a user cannot be expected to know an entity's UUID, so every
 * action that targets one must let them SEARCH, never require a typed id. This is the provisional,
 * deliberately-simple version — the polished typeahead (debounce, keyboard nav, accessibility) and
 * whether these actions live on the entity's own screen are for the UI-spec pass.
 *
 * Reuses `GET /api/contacts?q=` — PII-free (names only) and readable by any volunteer, so it is safe on
 * the President/VP access screen.
 */

type Match = { id: string; displayName: string };

export default function ContactPicker({
  onSelect,
  placeholder = "Search for a contact by name",
}: {
  /** Called with the chosen contact's id and name; called with null when the selection is cleared. */
  onSelect: (contact: { id: string; displayName: string } | null) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [chosen, setChosen] = useState<Match | null>(null);

  async function search(query: string) {
    setQ(query);
    if (!query.trim()) return setMatches([]);
    const res = await fetch(`/api/contacts?q=${encodeURIComponent(query)}`);
    if (!res.ok) return setMatches([]);
    const data = await res.json();
    setMatches((data.items ?? []).slice(0, 8));
  }

  function pick(m: Match) {
    setChosen(m);
    setMatches([]);
    setQ("");
    onSelect(m);
  }

  function clear() {
    setChosen(null);
    onSelect(null);
  }

  if (chosen) {
    return (
      <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
        <strong>{chosen.displayName}</strong>
        <button type="button" onClick={clear}>
          change
        </button>
      </span>
    );
  }

  return (
    <span style={{ display: "inline-block", position: "relative" }}>
      <input
        value={q}
        placeholder={placeholder}
        onChange={(e) => void search(e.target.value)}
        aria-label={placeholder}
      />
      {matches.length > 0 && (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 4,
            border: "1px solid #ccc",
            background: "white",
            position: "absolute",
            zIndex: 1,
            minWidth: 220,
          }}
        >
          {matches.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => pick(m)}
                style={{ display: "block", width: "100%", textAlign: "left" }}
              >
                {m.displayName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
