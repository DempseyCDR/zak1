import { z } from "zod";

// Feature 057 (P7-R14): the create/edit payload for the home-page promotional campaign slot. Validated at the
// write boundary (Constitution III). The image and CTA links are allowlisted at the boundary so an unsafe scheme
// can never be stored or rendered: the image URL must be absolute http(s); the CTA may be an internal site path
// or an absolute http(s) URL.

/** An absolute URL whose scheme is http or https (nothing else) — same refine as 053's promoLinks. */
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

/** A CTA target: an internal site path ('/…', not '//…') OR an absolute http(s) URL. */
const ctaUrl = z
  .string()
  .trim()
  .min(1)
  .refine((s) => {
    if (s.startsWith("/") && !s.startsWith("//")) return true; // internal path
    let u: URL;
    try {
      u = new URL(s);
    } catch {
      return false;
    }
    return u.protocol === "http:" || u.protocol === "https:";
  }, "cta url must be an internal path (/…) or an absolute http(s) URL");

/** A real calendar date in YYYY-MM-DD form. */
const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
  .refine(
    (s) => !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()),
    "date must be a real calendar date",
  );

export const campaignSchema = z
  .object({
    heading: z.string().trim().min(1),
    blurb: z.string().trim().min(1),
    image: z
      .object({ url: httpUrl, alt: z.string().trim().min(1) })
      .nullable()
      .default(null),
    cta: z.object({ label: z.string().trim().min(1), url: ctaUrl }),
    startDate: isoDate,
    endDate: isoDate,
  })
  .refine((c) => c.endDate >= c.startDate, {
    path: ["endDate"],
    message: "endDate must be on or after startDate",
  });

export type CampaignInput = z.infer<typeof campaignSchema>;
