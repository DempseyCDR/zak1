"use client";

/**
 * Feature 022 (B41): the single entry point for staff client `/api/*` calls.
 *
 * On a **401** (an expired/absent staff session — see `errors.unauthenticated`), send the user to sign in —
 * remembering where they were via the existing safe `?next` return-path (feature 015) — and return a promise
 * that **never settles**, so no caller ever reads the 401 body and paints an empty "no match" over an expired
 * session (the reproduced B41 defect). Never-settling (rather than throwing) keeps the common fire-and-forget
 * `void apiFetch(...).then(...)` call sites free of unhandled promise rejections.
 *
 * A **403** (authenticated but not permitted) and every other status pass straight through for the caller's
 * own inline handling. Server-side authorization is unchanged — this only changes how the client reacts.
 *
 * NOT for public pages (e.g. `/join`): a public visitor has no staff session to expire.
 */

// At most one sign-in navigation, even when several calls return 401 in the same tick.
let redirecting = false;

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401) {
    if (!redirecting && window.location.pathname !== "/login") {
      redirecting = true;
      const here = window.location.pathname + window.location.search;
      window.location.href = `/login?next=${encodeURIComponent(here)}`;
    }
    // The page is navigating to sign-in; never settle so no caller reads the 401 body.
    return new Promise<Response>(() => {});
  }
  return res;
}
