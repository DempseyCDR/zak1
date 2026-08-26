import { z } from "zod";

// Feature 056 (P7-R13): the post payload for the site-wide announcement banner. Validated at the write
// boundary (Constitution III). `text` is required; the optional link's URL is allowlisted to http(s) — the
// same refine as 053's promoLinks — so a `javascript:`/`data:` URL can never be stored or rendered.

/** A URL that parses as absolute AND whose scheme is http or https (nothing else). */
const httpUrl = z
  .string()
  .trim()
  .min(1)
  .refine((s) => {
    let u: URL;
    try {
      u = new URL(s);
    } catch {
      return false;
    }
    return u.protocol === "http:" || u.protocol === "https:";
  }, "url must be an absolute http(s) URL");

export const ANNOUNCEMENT_LEVELS = ["info", "urgent"] as const;

/** Sane cap on the active window: at least 1 hour, at most 720 (30 days). Default 24h. */
export const announcementPostSchema = z.object({
  text: z.string().trim().min(1),
  level: z.enum(ANNOUNCEMENT_LEVELS).default("info"),
  durationHours: z.number().int().min(1).max(720).default(24),
  link: z
    .object({ label: z.string().trim().min(1), url: httpUrl })
    .nullable()
    .default(null),
});

export type AnnouncementPostInput = z.infer<typeof announcementPostSchema>;
