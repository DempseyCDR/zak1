import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

// Feature 051 (P7-R7): render a content page's Markdown to SANITIZED HTML. This is the ONLY producer of HTML
// that a `dangerouslySetInnerHTML` may consume (the app's first) — so the allowlist here is the security
// boundary. Order matters: `marked` turns Markdown into HTML (passing through any raw HTML the author typed),
// then `sanitize-html` strips everything not on the allowlist (scripts, iframes, event handlers, unsafe URL
// schemes). Body headings are downgraded `h1 → h2` so the page keeps exactly one `<h1>` (its title).
export function renderMarkdown(md: string): string {
  const rawHtml = marked.parse(md, { async: false }) as string;
  return sanitizeHtml(rawHtml, {
    allowedTags: [
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "p",
      "a",
      "ul",
      "ol",
      "li",
      "strong",
      "em",
      "b",
      "i",
      "blockquote",
      "code",
      "pre",
      "hr",
      "br",
      "img",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
    ],
    allowedAttributes: {
      a: ["href", "title"],
      img: ["src", "alt", "title"],
    },
    // Absolute URLs must use a safe scheme; relative URLs (e.g. /docs/bylaws.pdf) are allowed by default so a
    // page can link committed static assets. No `data:`/`javascript:`.
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesAppliedToAttributes: ["href", "src"],
    allowProtocolRelative: false,
    // Rename any h1 (from `#` or injected) to h2 before the allowlist runs — the page owns the single H1.
    transformTags: { h1: "h2" },
  });
}
