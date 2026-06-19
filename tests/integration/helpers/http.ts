const BASE = "http://localhost";

export function jsonReq(method: string, path: string, body?: unknown): Request {
  return new Request(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Build the route-handler context with an async params bag. */
export function ctx<P extends Record<string, string> = Record<string, string>>(
  // Escape hatch: empty-params default for no-segment routes; cast is safe because
  // such handlers never read params. Test-only helper.
  params: P = {} as P,
) {
  return { params: Promise.resolve(params) };
}
