"use client";
import { apiFetch } from "@/app/apiFetch";

import { useCallback, useEffect, useState } from "react";

type SeriesMap = { seriesId: string; seriesKey: string; gateCustomer: string; qboClass: string };

export default function QboMappingPage() {
  const [seriesRows, setSeriesRows] = useState<SeriesMap[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch("/api/qbo-mapping");
    const data = await res.json();
    setSeriesRows(data.series ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSeries(s: SeriesMap) {
    const res = await apiFetch(`/api/qbo-mapping/series/${s.seriesId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gateCustomer: s.gateCustomer, qboClass: s.qboClass }),
    });
    setMessage(res.ok ? `Saved ${s.seriesKey}` : "Save failed");
    void load();
  }

  return (
    <main style={{ padding: 24, maxWidth: 820 }}>
      <h1>QBO Class / Customer Mapping</h1>
      {message && <p>{message}</p>}

      <h2>Series → gate customer / class</h2>
      <table>
        <thead>
          <tr>
            <th>Series</th>
            <th>Gate customer</th>
            <th>Class</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {seriesRows.map((s, i) => (
            <tr key={s.seriesId}>
              <td>{s.seriesKey}</td>
              <td>
                <input
                  value={s.gateCustomer}
                  onChange={(e) => {
                    const next = [...seriesRows];
                    next[i] = { ...s, gateCustomer: e.target.value };
                    setSeriesRows(next);
                  }}
                />
              </td>
              <td>
                <input
                  value={s.qboClass}
                  onChange={(e) => {
                    const next = [...seriesRows];
                    next[i] = { ...s, qboClass: e.target.value };
                    setSeriesRows(next);
                  }}
                />
              </td>
              <td>
                <button onClick={() => saveSeries(s)}>Save</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
