# zak1 — Phase 7 Requirements (collecting)

**Status:** Requirements collection — open, running doc (pre-spec). **Started:** 2026-08-12. **Drafted by:** Zak
(with Claude), from the cdrochester.org site audit — **review with Rich before any feature enters the pipeline.**

Phase 6 is complete (features 034–043). Phase 7 is the **public website rewrite**: zak1's public surface
replaces the WordPress site at cdrochester.org, **mobile-first**. Requirements are keyed `P7-Rn`; each will go
through the SpecKit pipeline later. **We are only collecting features now — specs come later.**

**Inputs:**

- **Site audit** of the current WordPress site: `/zel/contra/cdrochester-site/` (`findings.md` master report,
  `colors.md` palette, `pages/` per-page summaries, `photos/` 80 images). Referenced throughout as "audit".
- `docs/use-cases.md` — the public visitor is currently one thin row; §1 below expands it.
- Backlog **B44** (static content pages / lightweight CMS) — this phase forces that decision.

## 1. The public visitor — use cases

The rewrite is organized around what a visitor is trying to do, in rough frequency order:

1. **"Is there a dance tonight / this week? Where?"** — the dominant mobile moment. Answered above the fold:
   date, time, venue with tappable address, price. *(→ R4, R5)*
2. **"I'm new — what should I expect? Do I need a partner? What does it cost?"** — the growth funnel. The
   current site answers this well in voice ("if you can walk, you can dance") but scatters facts. *(→ R6, R10)*
3. **"How do I get there / park?"** — venue directions. *(→ R8)*
4. **"How do I join / support the club?"** — membership + donations. *(→ R12)*
5. **"Who's playing / calling?"** — performer rosters and per-event lineups. *(→ R5, R9)*
6. **"What happened at past dances?"** — history, galleries. *(→ existing `/what-was-on`, R11)*
7. **"Who do I contact about X?"** — role-based directory. *(→ R12)*
8. **"Is the dance cancelled?"** — announcements/status. *(→ R13)*

## 2. Overview of requirements

- **Foundation** — design tokens + mobile-first layout system (R1); public nav for small screens (R2).
- **Core pages** — public home (R3); `/whats-on` as scannable cards (R4); richer event detail (R5); series
  landing pages (R6); static content pages / B44 (R7).
- **Data-backed pages** — venues & directions (R8); performer rosters (R9); single-source pricing (R10);
  photo galleries (R11).
- **Org & campaign** — membership/contact/about cluster (R12); announcements (R13); 50th-anniversary slot
  (R14); printable calendar (R15).

Cross-cutting decisions that gate the whole phase are in §4. Content/data migration from WordPress is §5.

## 3. Requirements

### P7-R1 — Design tokens & mobile-first foundation

**What:** A small, explicit design system for the public site: color tokens, type scale, spacing, and layout
primitives — **designed at ~375 px first**, enhanced upward. Applied only to the `(public)` route group in this
phase.

**Why:** The public pages today are unstyled RSC with inline `style={{maxWidth: 720}}`. Every subsequent R-item
needs a visual foundation; doing it first prevents per-page ad-hoc styling.

**Grounding (audit):** the club already has a distinctive identity worth keeping — warm cream ground
`#f6efe4`, steel-blue bands `#2d728f` (hover `#22566c`), terracotta links `#b96131` (hover `#954e27`), peach
`#e5b79e`, charcoal text `#3d3b3d`; **Raleway** headings / **Open Sans** body; plus a functional pastel coding
for event types (contra `#82c2d6`, english `#ffb472`, special `#f28780`, assembly `#b3ce84`, meeting
`#9b84ce`). Keep the palette; fix the known contrast failure (peach-on-blue footer links).

**Decided here:** series color coding carries over and maps onto zak1's `series` table (→ R4). Accessibility
floor: WCAG AA contrast, honest heading order (the current site uses H1 twice per page).

**Open questions (§4 first):** Tailwind vs. hand-rolled tokens (D-1); whether series color becomes a `series`
column or a key-keyed constant map.

### P7-R2 — Public nav, small-screen pattern

**What:** `PublicNav` (034) gains a mobile presentation: collapsing menu (or deliberately short bar) below a
breakpoint, thumb-sized touch targets.

**Why:** The 034 bar is a desktop-shaped horizontal list; the nav will grow from 3 entries to ~10+ as R6/R7/R12
land. The current WP mega-menu (~35 destinations) is the cautionary tale — audit flags its small tap targets
and duplication.

**Grounding (code):** `PUBLIC_NAV` is a typed hand-maintained array (`src/app/publicNavItems.ts`), rendered by
`PublicNav.tsx` from the root layout on every page. Hand-maintenance was **decided** in P6-R1 (generation
tabled to B44) — unchanged here; this R-item is presentation only.

**Open questions:** IA — flat list vs. grouped sections (the audit's two-silo Contra/English structure is
mirrored substructure; we can likely collapse to one events system + two style pages). Volunteer second bar
(035) must coexist on small screens.

### P7-R3 — Public home page

**What:** A real home page at `/`: hero (photo + tagline in the club's voice), an announcement slot (R13), the
next-events strip, "new here?" call-to-action, 50th-anniversary slot (R14), footer with org info.

**Why:** P6-R3 made `/whats-on` the de-facto public home; that's the right answer for regulars but not for the
growth funnel — a first-time visitor needs orientation ("what is contra?", "all are welcome") before a listing.

**Grounding:** audit `pages/home.md` — current home = slider (multi-MB PNGs, the site's worst mobile cost),
YouTube embeds, about blurb, donate button, 6-event strip. Keep the *jobs*, drop the slider-era weight: one
optimized hero image, no carousel. `src/app/page.tsx` currently renders almost nothing (035 retired the staff
nav from it).

**Open questions:** does `/` become the home with `/whats-on` linked, or does `/` redirect to `/whats-on`
until R3 ships? Video embeds: keep (YouTube, lazy) or drop?

### P7-R4 — `/whats-on` as mobile-first event cards

**What:** Restyle `/whats-on` (and `/what-was-on`) from text rows to **tappable cards**: date prominent,
time, series (color-coded per R1), venue short name, price; whole card links to detail. "Tonight/next dance"
answers above the fold on a phone.

**Why:** Use case #1. The current WP site's equivalent (next-6 strip + calendar) is the most-used feature per
the audit; zak1's listing already has the right data, wrong presentation.

**Grounding (code):** shared `ScheduleList` / `SeriesFilter` server components (037) render both listings from
`listPublicEvents`; series filter is `?series=` server-rendered — all of that stays; this is presentation +
whatever fields the card needs that the public projection doesn't yet carry (price → R10, venue short name).

**Open questions:** does the card show the performer lineup (booked band/caller) — public pages currently show
confirmed bookings only (018 rule, keep)?

### P7-R5 — Event detail page enrichment

**What:** `/whats-on/[eventId]` grows into a real event page: series, date/time, venue block (name, tappable
address → map link, transit/parking note), price display, confirmed performer lineup, description, hero image
slot.

**Why:** Use cases #1/#3/#5 converge here; it's also the shareable artifact ("come to this dance" links).

**Grounding (code):** `getPublicEventDetail` exists (public-safe projection, confirmed-only bookings);
`venues` has `name`, `address`, `short_name`, lat/long (007-era). No image support exists anywhere in zak1 —
event imagery is new (schema + storage decision, see §4 D-4).

**Open questions:** per-event images in v1 or a per-series default photo (cheaper, likely sufficient);
directions text — per-venue field (R8) rendered here.

### P7-R6 — Series landing pages ("What is contra?" / "What is English?")

**What:** One page per dance style: what it is, why you'll love it (testimonials), what to expect (the FAQ
content: no partner needed, dress, etiquette, gender-free Larks/Robins calling), standing schedule sentence
(R10/R16), next dances of that series, photos, price.

**Why:** Use case #2 — the growth funnel. The audit's strongest finding on content: the *voice* of these pages
("they don't want to throw up on you", "I'm mainly here for the food") is the site's biggest asset — migrate
the copy, don't rewrite it.

**Grounding (audit):** current structure is two mirrored silos of 5 pages each (landing / why-you'll-love /
callers-and-bands / gallery / faqs). Proposal: collapse each silo to **one rich landing page per style** +
shared events/roster/gallery systems, cutting the page count without losing content.

**Open questions:** are these static content (→ R7/B44) or hand-built pages? Community/family dance — its own
landing or a section of the contra page?

### P7-R7 — Static content pages (forces backlog B44)

**What:** The org cluster of mostly-prose pages: mission, about-CDR, board of directors, resources
(etiquette, scholarships, performer info), policies (behavior/social contract PDFs, bylaws, privacy). Decide
**B44** — `content_pages` table + minimal admin editor vs. content as committed components.

**Why:** ~15 of the current site's pages are prose the club (VP/Webmaster role) will want to edit without a
deploy. B44's tabled recommendation was Tier-2: a `content_pages` table + small admin on the existing auth.

**Grounding:** `docs/use-cases.md` — Webmaster (VP delegate) owns public-facing content, co-edits with the
Booker; the authz substrate for a content editor already exists. The 034 decision tied "generate the public
menu" to B44 — if content pages land, menu generation for them comes back into scope.

**Open questions (§4 D-3):** B44 shape; migration path for the PDFs in `/flyers/` (host as static assets);
which pages are v1 vs. carried as links to the old site during transition.

### P7-R8 — Public venues & directions

**What:** A directions page (and per-event venue blocks, R5) rendering **public** venues only: name, address,
map link, directions/transit/parking text. Venue address visibility becomes an **explicit field**.

**Why:** Use case #3 — and a real defect in the current site: the audit found the WP venue directory dumping
**private-home addresses** and "null" placeholder records onto the public page. The rewrite must make public
exposure opt-in per venue, not a default.

**Grounding (code):** `venues` has name/address/short_name/landlord/lat/long — no `is_public`/directions
fields; the venues admin page (018/020) is where they'd be edited. Public core per audit: Rose Room (295
Gregory St), First Rochester (175 Allens Creek Rd), German House (315 Gregory St), Rosette Studio.

**Likely schema:** additive migration — `venues.is_public` (default **false**) + `venues.directions` text.

### P7-R9 — Public performer rosters (bands & callers)

**What:** Public roster page(s): bands (name, members + instruments, bio, photo, which style they play) and
callers, filterable by style; linked from event detail lineups.

**Why:** Use case #5; also serves bookers at *other* clubs scouting talent (the audit notes performer-contact
pages exist for this).

**Grounding (code):** `performers` (display_name, bio) and `bands`/`band_members` (008) exist and are
booking-grade real data; no public projection of them exists. **PII rule applies**: performer *contact* info
(email/phone via linked contact) is Organizer-gated — the public roster shows name/bio/photo only, with
booking inquiries routed to the role aliases (ContraBooking@/EnglishBooking@), not personal emails.

**Open questions:** performer photos (same storage decision as R5, §4 D-4); a "performs contra/english" tag —
new column or derived from booking history?

### P7-R10 — Single-source pricing & standing schedule

**What:** Admission prices and the standing weekly schedule become **data**, rendered wherever shown — event
cards, event detail, series landings, home, printable calendar — from one source.

**Why:** The audit's sharpest finding: prices are hand-duplicated across FAQs, slides, event pages, and the
printable calendar footer, **and they disagree** (contra "$12" vs sliding scale $15/$12/$5; ECD $12 vs $10;
lesson "6:10" vs "come 30 min early"). Single-sourcing is the core argument for the rewrite.

**Grounding (code):** ⚠️ **admission pricing is not modeled in zak1.** `series_parameters` holds *staff pay
rates* and expenses (category `rate`/`expense`), not admission prices; 018 left advertised price display-only.
Real pricing is structured: sliding scale with labels (supporter $15 / dancer $12 / student $5), family caps,
per-special-event pricing, "musicians free". Likely an additive `series_parameters` category (`admission`,
label + amount, effective-dated — the machinery already supports labels and effective dates) plus a per-event
override for specials.

**Also:** recurrence *rules* ("every Thursday 7:30", "first 4 Sundays, skip 2nd & 4th Jul–Aug", "no dancing
Thanksgiving/Christmas") are prose on the current site. Events themselves are already rows (013 recurrence
generator); the standing-schedule *sentence* can stay curated text (R7 content) — v1 does **not** need a
rules engine. Flag: ECD's DST-dependent start time is data the sentence must carry.

### P7-R11 — Photo galleries

**What:** Per-style (or per-event-group) photo galleries: responsive lazy grid, lightbox, **photographer
credits preserved**, decent alt text.

**Why:** Use case #6, and the imagery is the site's emotional core — real candid community photography
(credited: Kate Baron, Ashley Phillipps, Stephen Spinder, Lisa Brown, David Boyer, Rich Dempsey). Current
galleries are unstyled stacked full-size images; Masquerade photos are **hotlinked from Google Photos**
(fragile — import them).

**Grounding:** 80 photos already pulled to `/zel/contra/cdrochester-site/photos/` with an index (source page,
subject). Storage/serving decision shared with R5/R9 (§4 D-4).

### P7-R12 — Org cluster: membership, contact, about, donate

**What:** Public membership page (tiers: Supporter $50+ / Family $30 / Individual $20 / Student $10; year
runs **Sep 1–Aug 31**), role-based contact directory, board page, donate affordance.

**Why:** Use cases #4/#7. Grounding:

- **`/join` already exists** (019 US3: capture + PayPal hosted button) — R12 restyles and content-completes
  it rather than rebuilding. The WP site's PayPal cart (merchant `S7Q9HQDK2DXBE`, donate `A26Z8KLA9JUZE`)
  is the account to align with when the PayPal env goes live (pre-rollout TODO carried from Phase 6).
- ⚠️ The audit confirms the membership year is **Sep 1–Aug 31** → `club_settings.membership_year_end =
  08-31`. The Phase-6 pre-rollout TODO ("placeholder 08-31, set the real value") is resolved by
  observation: **the placeholder is already correct** — confirm with the Treasurer and close it.
- **Contact directory:** role aliases (president@, ContraBooking@, etc. — full list in audit findings §data-6)
  are club-side email config, rendered as a static/content page (R7); no schema. Don't repeat the WP site's
  JS-only email obfuscation — server-render them (they're role aliases, not personal PII).
- **Board page:** names/roles — content page (R7); zak1 role grants are *not* the source (they're access
  control, not the public officer list).

### P7-R13 — Announcements ("is the dance on?")

**What:** A lightweight announcement: short text (+ optional link), shown as a banner site-wide (or on
home + whats-on) while active. Covers cancellations, weather, big news.

**Why:** Use case #8. The current site derives a header banner from the latest blog post — manual and
easy to leave stale. Note the WP taxonomy uses **"Cancelled" as an event type** — status-as-type; zak1
should carry cancellation on the event (flag/status) so listings can show it properly, with the banner for
site-wide notice.

**Open questions:** full blog/news in v1, or just the banner (+ keep socials for narrative posts)? Likely
banner-only v1 — a **blog is out of scope** unless Rich disagrees. Who edits: Webmaster/VP grant.

### P7-R14 — 50th-anniversary campaign slot

**What:** A first-class promotional slot (home hero/banner + optional landing page) for the **Golden
Celebration Weekend, Nov 27–29 2026** — the rewrite launches mid-campaign.

**Why:** Hard date; the current site already runs a GoldenBanner slide. The slot should be reusable (next
year it's the Jane Austen Ball). Grounding: multi-venue, 4 callers, 5 bands — representable as an event
group (010/013 `event_groups`) + a content page (R7) + the banner (R13 machinery may suffice).

### P7-R15 — Printable calendar

**What:** A print-friendly schedule view: upcoming events as a clean table + the standing-schedule text,
CSS print styles.

**Why:** The audit singles this out as "clearly a valued artifact for older members" — cheap to keep, bad to
lose. Renders from the same `listPublicEvents` data (single-source, R10 prices in the footer done right).

## 4. Cross-cutting decisions (settle BEFORE features enter the pipeline)

- **D-1 · Styling approach — DECIDED (2026-08-18, Zak): Tailwind.** The R1 tokens (palette, type scale,
  series colors) become the Tailwind theme config; Fraunces stays as the display face. *(Rich may veto on
  dependency grounds — raised in this PR.)*
- **D-2 · Multi-contributor mode — DECIDED (2026-08-18, Zak): flip the switch.** Zak contributes code in
  Phase 7; per Constitution v1.3.0 §Development Workflow, **feature branches + mandatory PR review activate
  permanently** from the first landing. This document's own PR is the first artifact of that mode.
- **D-3 · B44 shape — DECIDED (2026-08-18, Zak): Tier-2 CMS** — `content_pages` table + admin editor on the
  existing auth (Webmaster/VP grant). **Open at spec time:** plain-markdown editor vs. a WYSIWYG editor
  library (candidates to evaluate: TipTap, Lexical) — Zak is comfortable taking a library here if it earns
  its keep.
- **D-4 · Image storage — DECIDED (2026-08-18, Zak): committed static assets for v1** (curated, low-churn);
  an upload substrate is acknowledged as a future need (galleries self-service) and deferred to a later
  phase — design nothing that precludes it.
- **D-5 · Cutover & hosting** — where the Next.js app runs in production, DNS cutover from WordPress,
  **redirects** for the old URL space (`/events/<slug>`, `/contra-dance/faqs`, RSS `/feed`, `/CDR/wp-content`
  asset links), and what (if anything) of WP survives (e.g. keep `/blog` archive read-only?). Also: analytics
  replacement (Site Kit/GT-MQRTLVJ), and the iContact signup embed (keep the service, render the form
  server-side-friendly).
- **D-6 · Event-type taxonomy mapping** — WP's 10 types (incl. Techno, Porch Dance, Ball Prep,
  Cancelled-as-type) vs. zak1's 4 series. Map: recurring styles → series; one-offs → event groups/labels
  (010/013); **Cancelled → event status, not type** (R13). Needs a one-time content decision per historical
  type during migration (§5).

## 5. Content & data migration (one-time, scoped later)

The WP site's live data (audit findings §"Live data") vs. zak1's schema:

| WP data | zak1 home | Gap |
|---|---|---|
| Events (+types, prices, venue, performers) | `events`/`series`/`event_groups` | historical import optional; type mapping D-6 |
| Venues | `venues` | `is_public` + `directions` (R8); import the 4 public ones |
| Performers/bands | `performers`/`bands` | photos (D-4); style tags (R9) |
| Prices | — | **new** (R10) |
| Standing schedule prose | — | content (R7) |
| Org pages, FAQs, policies | — | B44 (D-3); PDFs as static assets |
| News/banner | — | R13 (banner-only v1) |
| Photos | — | import from `/zel/contra/cdrochester-site/photos/` + Google Photos rescue (R11, D-4) |
| Signup/PayPal/socials/analytics | partial (`/join`) | D-5 |

## 6. Explicitly out of scope for Phase 7

- Admin/door page restyle (desktop/tablet tools; the door check-in tablet experience is a future phase).
- Full online ticket sales (007 US2 / B1 / B2 — long-deferred, unchanged).
- Blog/news system beyond the R13 banner (unless Rich pulls it in).
- Recurrence-rules engine (013's generator + curated schedule sentences suffice).
- B40 (contact email UI), B42 (expense reimbursement), B43 (`is_donated` simplification) — carry forward,
  not Phase 7 concerns.
