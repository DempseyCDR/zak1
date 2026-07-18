import Link from "next/link";
import { requireActor } from "@/server/auth/currentStaff";
import { actorCan } from "@/server/auth/can";
import { apiInventory, uiInventory } from "@/server/lib/routeInventory";

/**
 * The route index (feature 016, US5) — GENERATED from the source tree, Super-user only.
 *
 * This page used to carry two hand-maintained arrays that a `CLAUDE.md` convention told everyone to
 * keep in sync. Both are gone: `routeInventory` walks `src/app` at request time, so a new route appears
 * here with no edit, and it shares that walker with `auth.routeInventory.test.ts` — the page cannot
 * disagree with the guard.
 *
 * Role-aware nav (FR-039) replaces this for *pages*, but the API endpoints have no nav home and
 * enumerating them is the index's real job. It is restricted to the **Super-user** via a capability
 * (FR-040b) — never an inline `role === 'super_user'` check, which would be a second authorization
 * mechanism beside the catalog.
 *
 * This page is NOT under a protecting route group, so it does its own `requireActor` + capability gate.
 */
export default async function DevRoutesPage() {
  const actor = await requireActor();
  if (!actorCan(actor, "dev.routes.read")) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Not authorized</h1>
        <p>The route index is available to the Super-user only.</p>
      </main>
    );
  }

  const ui = uiInventory();
  const api = apiInventory().filter((r) => !r.path.startsWith("/api/auth")); // auth routes are public

  return (
    <main style={{ padding: 24, maxWidth: 960 }}>
      <h1>Route index</h1>
      <p>
        Generated from the source tree at request time — no hand-maintained list. Shows every UI
        page and API endpoint, each endpoint with its declared authorization requirement.
      </p>

      <h2>UI pages</h2>
      <ul>
        {ui.map((p) => (
          <li key={p.path}>
            {/* A dynamic-segment path (e.g. /organizer/[seriesKey]) is a template, not a navigable
                URL — the App Router rejects it as a <Link> href, so show it as plain text. */}
            {p.path.includes("[") ? <code>{p.path}</code> : <Link href={p.path}>{p.path}</Link>}
          </li>
        ))}
      </ul>

      <h2 style={{ marginTop: 24 }}>API endpoints</h2>
      <table>
        <thead>
          <tr>
            <th align="left">Path</th>
            <th align="left">Method</th>
            <th align="left">Requires</th>
          </tr>
        </thead>
        <tbody>
          {api.flatMap((r) =>
            r.methods.map((m) => (
              <tr key={`${r.path}:${m.method}`}>
                <td>
                  <code>{r.path}</code>
                </td>
                <td>{m.method}</td>
                <td>
                  <code>{m.requires ?? "—"}</code>
                </td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </main>
  );
}
