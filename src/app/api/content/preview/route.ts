import { NextResponse } from "next/server";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { contentPreviewSchema } from "@/server/validation/content";
import { renderMarkdown } from "@/server/domain/content/markdown";

// Feature 051 (P7-R7): render a draft to sanitized HTML for the editor's preview — the SAME server pipeline as
// the public page (one sanitization path, no client Markdown). content.write only.
export const POST = withAuth({ requires: "content.write" }, async (req) => {
  const { markdown } = await parseBody(req, contentPreviewSchema);
  return NextResponse.json({ html: renderMarkdown(markdown) });
});
