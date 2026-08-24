-- Feature 051 (P7-R7): the Tier-2 content CMS (D-3). A store of editable prose "content pages" the Webmaster
-- edits (Markdown) and publishes; the public reads the published body at /<slug>. Additive — a new table, no
-- data transform. Body is Markdown, rendered to sanitized HTML on read (never trusted raw). draft_body is what
-- the Webmaster edits/previews; published_body is what the public sees (null until first publish, retained on
-- unpublish); published gates public visibility.
CREATE TABLE IF NOT EXISTS content_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  draft_body text NOT NULL,
  published_body text,
  published boolean NOT NULL DEFAULT false,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
