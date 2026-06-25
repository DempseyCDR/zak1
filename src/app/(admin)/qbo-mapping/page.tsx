"use client";

import { useCallback, useEffect, useState } from "react";

type Account = { lineKey: string; accountCode: string; accountName: string };
type SeriesMap = { seriesId: string; seriesKey: string; gateCustomer: string; qboClass: string };

export default function QboMappingPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [seriesRows, setSeriesRows] = useState<SeriesMap[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/qbo-mapping");
    const data = await res.json();
    setAccounts(data.accounts ?? []);
    setSeriesRows(data.series ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveAccount(a: Account) {
    const res = await fetch(`/api/qbo-mapping/accounts/${a.lineKey}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountCode: a.accountCode, accountName: a.accountName }),
    });
    setMessage(res.ok ? `Saved ${a.lineKey}` : "Save failed");
    void load();
  }

  return (
    <main style={{ padding: 24, maxWidth: 820 }}>
      <h1>QBO Account / Class Mapping</h1>
      {message && <p>{message}</p>}

      <h2>Accounts</h2>
      <table>
        <thead><tr><th>Line</th><th>Account code</th><th>Account name</th><th /></tr></thead>
        <tbody>
          {accounts.map((a, i) => (
            <tr key={a.lineKey}>
              <td>{a.lineKey}</td>
              <td>
                <input
                  value={a.accountCode}
                  onChange={(e) => {
                    const next = [...accounts];
                    next[i] = { ...a, accountCode: e.target.value };
                    setAccounts(next);
                  }}
                />
              </td>
              <td>
                <input
                  value={a.accountName}
                  onChange={(e) => {
                    const next = [...accounts];
                    next[i] = { ...a, accountName: e.target.value };
                    setAccounts(next);
                  }}
                  style={{ width: 280 }}
                />
              </td>
              <td><button onClick={() => saveAccount(a)}>Save</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Series → gate customer / class</h2>
      <ul>
        {seriesRows.map((s) => (
          <li key={s.seriesId}>{s.seriesKey}: {s.gateCustomer} / {s.qboClass}</li>
        ))}
      </ul>
    </main>
  );
}
