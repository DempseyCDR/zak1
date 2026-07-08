import { z } from "zod";

export const eventGroupCreateSchema = z.object({
  name: z.string().trim().min(1),
  // Free-text, optional category (feature 010; was a fixed enum). Empty/whitespace → omitted (null).
  kind: z.string().trim().min(1).optional(),
});

export const eventCreateSchema = z.object({
  seriesKey: z.string().min(1),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "eventDate must be YYYY-MM-DD"),
  chargesAdmission: z.boolean().default(true),
  groupId: z.string().uuid().optional(),
  // Feature 013: optional label, venue-local wall-clock start time (HH:MM), and public description.
  label: z.string().trim().min(1).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "startTime must be HH:MM").optional(),
  description: z.string().trim().min(1).optional(),
});

export const doorRecordCreateSchema = z.object({
  eventId: z.string().uuid(),
});

// Money fields arrive as dollar numbers; converted to cents in the service.
// Gross cash (total cash incl. seed float) and PC gross (total card) are entered;
// admission is derived from them minus the non-admission gate lines.
export const doorRecordPatchSchema = z.object({
  posTransactionCount: z.number().int().min(0).optional(),
  grossCash: z.number().min(0).optional(),
  pcGross: z.number().min(0).optional(),
  seedFloat: z.number().min(0).optional(),
  cashPaidOut: z.number().min(0).optional(),
  cashPaidOutReason: z.string().min(1).optional(),
  giftCardRedemptionCount: z.number().int().min(0).optional(),
});

// Admission is never an entered gate line — it is derived in the report.
const gateCategory = z.enum([
  "merchandise",
  "donation",
  "future_event",
  "membership",
  "gift_card",
  "misc_sales",
]);

const NAMED_CATEGORIES = new Set(["donation", "future_event", "membership"]);

export const gateSalesPutSchema = z.object({
  sales: z
    .array(
      z
        .object({
          category: gateCategory,
          paymentMethod: z.enum(["cash", "card"]),
          amount: z.number().min(0),
          contactId: z.string().uuid().optional(),
        })
        .refine((s) => !NAMED_CATEGORIES.has(s.category) || !!s.contactId, {
          message: "donation, future_event, and membership lines require a contactId",
          path: ["contactId"],
        }),
    )
    .default([]),
});

export type EventGroupCreateInput = z.infer<typeof eventGroupCreateSchema>;
export type EventCreateInput = z.infer<typeof eventCreateSchema>;
export type DoorRecordCreateInput = z.infer<typeof doorRecordCreateSchema>;
export type DoorRecordPatchInput = z.infer<typeof doorRecordPatchSchema>;
export type GateSalesPutInput = z.infer<typeof gateSalesPutSchema>;
