import { z } from "zod";

export const eventGroupCreateSchema = z.object({
  name: z.string().trim().min(1),
  kind: z.enum(["double_dance", "weekend", "jane_austen_ball", "other"]),
});

export const eventCreateSchema = z.object({
  seriesKey: z.string().min(1),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "eventDate must be YYYY-MM-DD"),
  chargesAdmission: z.boolean().default(true),
  groupId: z.string().uuid().optional(),
});

export const doorRecordCreateSchema = z.object({
  eventId: z.string().uuid(),
});

// Money fields arrive as dollar numbers; converted to cents in the service.
export const doorRecordPatchSchema = z.object({
  posTransactionCount: z.number().int().min(0).optional(),
  posGross: z.number().min(0).optional(),
  grossCash: z.number().min(0).optional(),
  seedFloat: z.number().min(0).optional(),
  cashPaidOut: z.number().min(0).optional(),
  cashPaidOutReason: z.string().min(1).optional(),
  giftCardRedemptionCount: z.number().int().min(0).optional(),
});

const gateCategory = z.enum([
  "today_admission",
  "merchandise",
  "donation",
  "future_event",
  "membership",
  "gift_card",
  "misc_sales",
]);

export const gateSalesPutSchema = z.object({
  sales: z
    .array(
      z.object({
        category: gateCategory,
        paymentMethod: z.enum(["cash", "card"]),
        amount: z.number().min(0),
      }),
    )
    .default([]),
});

export type EventGroupCreateInput = z.infer<typeof eventGroupCreateSchema>;
export type EventCreateInput = z.infer<typeof eventCreateSchema>;
export type DoorRecordCreateInput = z.infer<typeof doorRecordCreateSchema>;
export type DoorRecordPatchInput = z.infer<typeof doorRecordPatchSchema>;
export type GateSalesPutInput = z.infer<typeof gateSalesPutSchema>;
