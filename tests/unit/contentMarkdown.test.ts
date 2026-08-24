import { describe, it, expect } from "vitest";
import { renderMarkdown } from "@/server/domain/content/markdown";

// Feature 051 (P7-R7): renderMarkdown is the ONLY producer of HTML for the public page's
// dangerouslySetInnerHTML, so this is the security test — untrusted Markdown must never yield executable
// or dangerous HTML, while safe Markdown renders as expected.
describe("renderMarkdown — sanitization (security)", () => {
  it("strips <script> entirely", () => {
    const html = renderMarkdown("hello\n\n<script>alert(1)</script>");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(1)");
  });

  it("strips event-handler attributes on injected tags", () => {
    const html = renderMarkdown('<img src="x" onerror="alert(1)">');
    expect(html.toLowerCase()).not.toContain("onerror");
  });

  it("neutralizes javascript: and data: link hrefs", () => {
    const js = renderMarkdown("[click](javascript:alert(1))");
    expect(js.toLowerCase()).not.toContain("javascript:");
    const data = renderMarkdown('<a href="data:text/html,<script>alert(1)</script>">x</a>');
    expect(data.toLowerCase()).not.toContain("data:text/html");
  });

  it("strips <iframe> and <style>", () => {
    const html = renderMarkdown('<iframe src="https://evil.example"></iframe><style>x{}</style>');
    expect(html.toLowerCase()).not.toContain("<iframe");
    expect(html.toLowerCase()).not.toContain("<style");
  });
});

describe("renderMarkdown — safe rendering", () => {
  it("renders headings, but never an <h1> (the page owns the single H1)", () => {
    const html = renderMarkdown("# Big Title\n\n## Section");
    expect(html).not.toContain("<h1");
    expect(html).toContain("Big Title"); // downgraded, text preserved
    expect(html).toContain("<h2");
  });

  it("renders emphasis, lists, blockquote, and code", () => {
    const html = renderMarkdown("**bold** and *em*\n\n- one\n- two\n\n> quote\n\n`code`");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<li>");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("<code>");
  });

  it("keeps a relative link to a committed asset (e.g. a policy PDF)", () => {
    const html = renderMarkdown("[Bylaws](/docs/bylaws.pdf)");
    expect(html).toContain('href="/docs/bylaws.pdf"');
  });

  it("keeps http(s) and mailto links", () => {
    const html = renderMarkdown(
      "[site](https://cdrochester.org) [mail](mailto:info@cdrochester.org)",
    );
    expect(html).toContain('href="https://cdrochester.org"');
    expect(html).toContain('href="mailto:info@cdrochester.org"');
  });
});
