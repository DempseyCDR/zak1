# Contract: Public home page + site-wide footer

The interface this feature presents to visitors. No HTTP/API surface — the contract is the home's sections
and the shared footer's guarantees.

## Home page (`/`)

Renders (in order), inside the `(public)` styling wrapper with the R2 nav above it:

1. **Hero** — a tokenized band with the club-voice **tagline** and a primary orientation CTA. At most one
   optimized image (via `next/image`); degrades to the text band if the image is absent/fails. No
   carousel, no video.
2. **"New here?" orientation** — copy conveying what the dancing is, that all are welcome and no partner is
   needed, and roughly the cost, with an onward link (to `/whats-on`).
3. **Next dances** — the next few upcoming dances (reused schedule), each linking to its detail; a clear
   empty-state message when none.
4. A **link to `/whats-on`** for the full schedule.

Guarantees: exactly **one `<h1>`**, honest heading order; **no horizontal scroll at 375px**; **WCAG AA**
via the R1 tokens; orientation content precedes the listing. The old staff stub (the "CDR Platform"
heading + Contacts link) is gone.

## Site-wide footer

Rendered by the `(public)` layout on **every public page** (home, whats-on, what-was-on, event detail,
join) and **never** on admin/door. A semantic `<footer>` (contentinfo landmark) containing:

- club identity,
- a few key links (e.g. What's On, Join),
- a **support/donate affordance**.

Guarantees: one contentinfo landmark per page; links resolve; WCAG AA via tokens.

## Scope boundary

Presentation only, plus moving `/` into the `(public)` group. No new data model, no new destination pages,
no video, no image-storage system (single static hero asset), and the announcement (R13) / 50th (R14)
regions are not built here.
