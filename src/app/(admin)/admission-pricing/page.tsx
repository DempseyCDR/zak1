"use client";
import { apiFetch } from "@/app/apiFetch";

import { useCallback, useEffect, useState } from "react";

type Series = { id: string; key: string; name: string };
type Tier = { label: string; amount: string }; // amount in dollars (string, editable)
type Revision = {
  effectiveDate: string;
  tiers: { label: string; amountCents: number; sortOrder: number }[];
};

const today = () => new Date().toISOString().slice(0, 10);

export default function AdmissionPricingPage() {
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [seriesId, setSeriesId] = useState("");
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [effectiveDate, setEffectiveDate] = useState(today());
  const [tiers, setTiers] = useState<Tier[]>([{ label: "", amount: "" }]);
  const [scheduleSentence, setScheduleSentence] = useState("");
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch("/api/series")
      .then((r) => r.json())
      .then((d) => setSeriesList(d.items ?? []));
  }, []);

  const loadRevisions = useCallback(async () => {
    if (!seriesId) {
      setRevisions([]);
      return;
    }
    const r = await apiFetch(`/api/admission-pricing?series=${seriesId}`);
    const data = await r.json();
    setRevisions(data.revisions ?? []);
    setScheduleSentence(data.scheduleSentence ?? "");
  }, [seriesId]);

  useEffect(() => {
    void loadRevisions();
  }, [loadRevisions]);

  function setTier(i: number, patch: Partial<Tier>) {
    setTiers((t) => t.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function addTier() {
    setTiers((t) => [...t, { label: "", amount: "" }]);
  }
  function removeTier(i: number) {
    setTiers((t) => t.filter((_, idx) => idx !== i));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const parsed = tiers
      .filter((t) => t.label.trim() !== "")
      .map((t) => ({
        label: t.label.trim(),
        amountCents: Math.round(Number(t.amount || "0") * 100),
      }));
    if (parsed.length === 0) {
      setMessage("Add at least one tier (a label and amount).");
      return;
    }
    const res = await apiFetch("/api/admission-pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seriesId, effectiveDate, tiers: parsed }),
    });
    if (!res.ok) {
      setMessage((await res.json().catch(() => null))?.error?.message ?? "Failed to save pricing");
      return;
    }
    setTiers([{ label: "", amount: "" }]);
    setMessage("Saved.");
    void loadRevisions();
  }

  async function saveSchedule(e: React.FormEvent) {
    e.preventDefault();
    setScheduleMessage(null);
    const res = await apiFetch("/api/admission-pricing/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seriesId,
        sentence: scheduleSentence.trim() === "" ? null : scheduleSentence.trim(),
      }),
    });
    setScheduleMessage(res.ok ? "Saved." : "Failed to save schedule sentence");
  }

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1>Admission pricing</h1>
      <p style={{ color: "#555" }}>
        Effective-dated, per series. Every public surface (cards, event detail, series landing,
        home) shows this pricing — set it once here.
      </p>

      <label style={{ display: "block", margin: "12px 0" }}>
        Series:{" "}
        <select value={seriesId} onChange={(e) => setSeriesId(e.target.value)}>
          <option value="">— pick a series —</option>
          {seriesList.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      {seriesId && (
        <>
          <h2>Current & past revisions</h2>
          {revisions.length === 0 ? (
            <p style={{ color: "#888" }}>No pricing configured yet.</p>
          ) : (
            <ul>
              {revisions.map((rev, i) => (
                <li key={i}>
                  <strong>from {rev.effectiveDate}:</strong>{" "}
                  {rev.tiers
                    .map((t) => `${t.label} $${(t.amountCents / 100).toFixed(2)}`)
                    .join(" · ")}
                </li>
              ))}
            </ul>
          )}

          <h2>Add a revision</h2>
          <form onSubmit={save} style={{ display: "grid", gap: 8, maxWidth: 460 }}>
            <label>
              Effective date:{" "}
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </label>
            <fieldset>
              <legend>Tiers (label + dollar amount; $0 = free, e.g. musicians)</legend>
              {tiers.map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 4, marginTop: 4 }}>
                  <input
                    placeholder="label (e.g. Dancer)"
                    aria-label={`tier ${i + 1} label`}
                    value={t.label}
                    onChange={(e) => setTier(i, { label: e.target.value })}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="amount"
                    aria-label={`tier ${i + 1} amount`}
                    value={t.amount}
                    onChange={(e) => setTier(i, { amount: e.target.value })}
                  />
                  <button type="button" onClick={() => removeTier(i)}>
                    ×
                  </button>
                </div>
              ))}
              <button type="button" onClick={addTier} style={{ marginTop: 4 }}>
                + Add tier
              </button>
            </fieldset>
            <button type="submit">Save revision</button>
            {message && (
              <p style={{ color: message === "Saved." ? "green" : "crimson" }}>{message}</p>
            )}
          </form>

          <h2>Standing-schedule sentence</h2>
          <form onSubmit={saveSchedule} style={{ display: "grid", gap: 8, maxWidth: 460 }}>
            <textarea
              aria-label="Schedule sentence"
              placeholder='e.g. "Every Thursday, 7:30–10:30; lesson at 7:00."'
              value={scheduleSentence}
              onChange={(e) => setScheduleSentence(e.target.value)}
              rows={2}
            />
            <button type="submit">Save schedule sentence</button>
            {scheduleMessage && (
              <p style={{ color: scheduleMessage === "Saved." ? "green" : "crimson" }}>
                {scheduleMessage}
              </p>
            )}
          </form>
        </>
      )}
    </main>
  );
}
