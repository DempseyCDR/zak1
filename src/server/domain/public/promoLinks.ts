import { z } from "zod";

// Feature 053 (P7-R9): self-published promotional links + dance-style tags for the public performer roster.
// Promotional links are the ONE exception to performer PII gating — they are public-safe — but they render as
// public `<a href>`, so the URL scheme is allowlisted to http(s) at the write boundary (this module): a
// `javascript:`/`data:`/`mailto:` URL can never be stored, so it can never be emitted as a link.

export const PROMO_LINK_TYPES = [
  "website",
  "facebook",
  "instagram",
  "youtube",
  "bandcamp",
  "spotify",
  "other",
] as const;

export type PromoLinkType = (typeof PROMO_LINK_TYPES)[number];

export type PromoLink = { type: PromoLinkType; url: string };

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

export const promoLinkSchema: z.ZodType<PromoLink> = z.object({
  type: z.enum(PROMO_LINK_TYPES),
  url: httpUrl,
});

export const promoLinksSchema = z.array(promoLinkSchema).default([]);

// The club's dance styles — the closed set a band/caller may be tagged with (roster grouping + filter).
export const STYLE_TAGS = ["contra", "english", "community"] as const;

export type StyleTag = (typeof STYLE_TAGS)[number];

export const stylesSchema = z.array(z.enum(STYLE_TAGS)).default([]);

/** Is `s` one of the known style tags? (guards a `?style=` query param before it hits the DB filter). */
export function isStyleTag(s: string): s is StyleTag {
  return (STYLE_TAGS as readonly string[]).includes(s);
}
