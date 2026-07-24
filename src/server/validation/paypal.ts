import { z } from "zod";

/**
 * Feature 019 US3 (FR-011): a PayPal webhook notification, parsed BEFORE any field is trusted. Modelled on
 * PAYMENT.CAPTURE.COMPLETED for a hosted button; `.passthrough()` keeps the raw payload intact for storage
 * and manual reconciliation. The EXACT field paths are confirmed against a real sandbox notification at
 * implementation (spec Clarifications) — `extractNotification` localizes that so only one place changes.
 */
export const paypalWebhookSchema = z
  .object({
    id: z.string().min(1),
    event_type: z.string().min(1),
    resource: z
      .object({
        amount: z.object({ value: z.string() }).partial().optional(),
        payer: z.object({ email_address: z.string() }).partial().optional(),
        payee: z.object({ email_address: z.string() }).partial().optional(),
      })
      .passthrough(),
  })
  .passthrough();

export type PaypalWebhook = z.infer<typeof paypalWebhookSchema>;

export type ExtractedNotification = {
  providerEventId: string;
  eventType: string;
  payerEmail: string | null;
  amountCents: number;
};

/** Pull the fields we act on out of the (already-parsed) payload. Dollars→cents; missing → 0/null. */
export function extractNotification(p: PaypalWebhook): ExtractedNotification {
  const value = p.resource.amount?.value;
  const amountCents = value ? Math.round(parseFloat(value) * 100) : 0;
  const payerEmail = p.resource.payer?.email_address ?? null;
  return { providerEventId: p.id, eventType: p.event_type, payerEmail, amountCents };
}
