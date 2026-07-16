import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The route walker (feature 016) — enumerate the app's routes FROM THE SOURCE TREE.
 *
 * Shared by two callers, which is the whole point (FR-040a):
 * - `auth.routeInventory.test.ts` asserts every API method declares a requirement (the guard).
 * - `/dev/routes` renders the same enumeration (the developer index).
 *
 * One walker means the index cannot disagree with the guard, and a new route appears in both with no
 * edit to any hand-written list — which is the defect the retired `/dev/routes` convention had.
 */

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

function findFiles(dir: string, name: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...findFiles(full, name));
    else if (entry === name) out.push(full);
  }
  return out;
}

export type ExportedMethod = {
  method: string;
  /** The wrapper the method is built from (`withAuth`, or something else for auth routes). */
  wrapper: string;
  /** The declared requirement (`base` or a capability), or null if none was declared. */
  requires: string | null;
};

/** Every exported HTTP method of a route file, and the requirement it declares. */
export function exportedMethods(source: string): ExportedMethod[] {
  const re = new RegExp(
    `export\\s+const\\s+(${HTTP_METHODS.join("|")})\\s*(?::[^=]+)?=\\s*([A-Za-z_$][\\w$]*)` +
      // optional explicit type arg (`withAuth<{ id: string }>`), then an optional `{ requires: "x" }`
      `(?:<[^>]*>)?\\(\\s*(?:\\{\\s*requires:\\s*"([^"]+)")?`,
    "g",
  );
  const found: ExportedMethod[] = [];
  for (const m of source.matchAll(re)) {
    found.push({ method: m[1]!, wrapper: m[2]!, requires: m[3] ?? null });
  }
  return found;
}

/** Absolute paths of every `route.ts` under `src/app/api`. */
export function apiRouteFiles(root = process.cwd()): string[] {
  return findFiles(join(root, "src/app/api"), "route.ts");
}

export type ApiRoute = {
  /** URL-ish path, e.g. `/api/events/[id]` (route-group folders are not part of the API path). */
  path: string;
  methods: ExportedMethod[];
};

/** The API surface: each `route.ts`, its URL path, and its methods' declared requirements. */
export function apiInventory(root = process.cwd()): ApiRoute[] {
  const apiRoot = join(root, "src/app/api");
  return apiRouteFiles(root)
    .map((file) => {
      const rel = file.slice(apiRoot.length).replace(/\/route\.ts$/, "");
      return { path: `/api${rel}`, methods: exportedMethods(readFileSync(file, "utf8")) };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

export type UiPage = { path: string };

/**
 * The UI surface: each `page.tsx` under `src/app`, as a URL path.
 *
 * Route groups — parenthesised folders like `(admin)` — do not appear in the URL, so they are stripped.
 * `/dev/routes` renders this alongside the API inventory; it is a developer aid, not a security surface.
 */
export function uiInventory(root = process.cwd()): UiPage[] {
  const appRoot = join(root, "src/app");
  return findFiles(appRoot, "page.tsx")
    .map((file) => {
      let rel = file.slice(appRoot.length).replace(/\/page\.tsx$/, "");
      rel = rel.replace(/\/\([^/]+\)/g, ""); // drop route-group segments
      return { path: rel === "" ? "/" : rel };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}
