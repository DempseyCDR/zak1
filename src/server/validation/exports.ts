import { z } from "zod";

export const listIdSchema = z.enum([
  "contra",
  "english",
  "openband",
  "specialevents",
  "performer",
  "member",
]);

export const eventIdSchema = z.string().uuid();

export type ListId = z.infer<typeof listIdSchema>;
