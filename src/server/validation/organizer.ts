import { z } from "zod";

export const expenseParameterCreateSchema = z.object({
  seriesKey: z.string().min(1),
  kind: z.enum(["rent", "ongoing"]),
  amount: z.number().min(0),
  label: z.string().trim().min(1).optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "effectiveDate must be YYYY-MM-DD"),
});

export const miscExpenseCreateSchema = z.object({
  description: z.string().trim().min(1),
  amount: z.number().min(0),
});

export type ExpenseParameterCreateInput = z.infer<typeof expenseParameterCreateSchema>;
export type MiscExpenseCreateInput = z.infer<typeof miscExpenseCreateSchema>;
