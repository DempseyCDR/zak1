import { NextResponse } from "next/server";
import { withLogging } from "@/server/lib/withLogging";
import { beginAuthorization } from "@/server/auth/google";
import { safeNextPath } from "@/server/auth/redirect";
import { NEXT_COOKIE, STATE_COOKIE, VERIFIER_COOKIE, serializeCookie } from "@/server/auth/cookies";

/** Start Google sign-in (contracts §1). Public: this is how one becomes authenticated. */
export const GET = withLogging(async (req) => {
  const url = new URL(req.url);
  // `next` is attacker-controllable and survives the round trip to Google — never trust it raw.
  const next = safeNextPath(url.searchParams.get("next"));

  const { url: authUrl, state, codeVerifier } = beginAuthorization();

  const res = NextResponse.redirect(authUrl);
  // Short-lived: only needs to survive the trip to Google and back.
  const opts = { maxAgeSeconds: 600 };
  res.headers.append("Set-Cookie", serializeCookie(STATE_COOKIE, state, opts));
  res.headers.append("Set-Cookie", serializeCookie(VERIFIER_COOKIE, codeVerifier, opts));
  res.headers.append("Set-Cookie", serializeCookie(NEXT_COOKIE, next, opts));
  return res;
});
