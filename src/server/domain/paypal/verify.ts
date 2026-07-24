import { getPaypalEnv } from "@/server/validation/env";
import { logger } from "@/server/lib/logger";

/**
 * Feature 019 US3 (FR-011, research R1): verify a PayPal webhook's authenticity at PayPal's own
 * `verify-webhook-signature` endpoint — the ONE network seam. Per Constitution v1.2.0 §Technology
 * Standards (the third-party carve-out feature 015 uses for Google), automated tests never call this;
 * they exercise everything BEHIND it against real Postgres and pass the boolean outcome directly.
 */

/** The five PayPal-supplied headers the verification call needs. */
export type PaypalHeaders = {
  transmissionId: string | null;
  transmissionTime: string | null;
  transmissionSig: string | null;
  certUrl: string | null;
  authAlgo: string | null;
};

export function readPaypalHeaders(h: Headers): PaypalHeaders {
  return {
    transmissionId: h.get("paypal-transmission-id"),
    transmissionTime: h.get("paypal-transmission-time"),
    transmissionSig: h.get("paypal-transmission-sig"),
    certUrl: h.get("paypal-cert-url"),
    authAlgo: h.get("paypal-auth-algo"),
  };
}

/** Pure decision: PayPal reports SUCCESS. Isolated so it is unit-testable without any network. */
export function interpretVerifyResponse(body: { verification_status?: unknown }): boolean {
  return body.verification_status === "SUCCESS";
}

async function paypalAccessToken(base: string, id: string, secret: string): Promise<string> {
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new Error("PayPal token request failed");
  return body.access_token;
}

/**
 * True only if PayPal confirms the signature. Any error (misconfig, network, non-SUCCESS) → false: an
 * unverifiable notification must never be treated as verified. Never throws to the caller.
 */
export async function verifyPaypalWebhook(
  headers: PaypalHeaders,
  rawBody: string,
): Promise<boolean> {
  try {
    const env = getPaypalEnv();
    if (
      !headers.transmissionId ||
      !headers.transmissionTime ||
      !headers.transmissionSig ||
      !headers.certUrl ||
      !headers.authAlgo
    ) {
      return false;
    }
    const token = await paypalAccessToken(
      env.PAYPAL_API_BASE,
      env.PAYPAL_CLIENT_ID,
      env.PAYPAL_CLIENT_SECRET,
    );
    const res = await fetch(`${env.PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        transmission_id: headers.transmissionId,
        transmission_time: headers.transmissionTime,
        cert_url: headers.certUrl,
        auth_algo: headers.authAlgo,
        transmission_sig: headers.transmissionSig,
        webhook_id: env.PAYPAL_WEBHOOK_ID,
        webhook_event: JSON.parse(rawBody),
      }),
    });
    return interpretVerifyResponse((await res.json()) as { verification_status?: unknown });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "paypal_verify_failed");
    return false;
  }
}
