import Link from "next/link";

/**
 * Series filter (feature 037, P6-R5) — server-rendered via the URL query param, so the filtered view is
 * shareable and both listings stay pure server components. Renders an "All" link plus one
 * `basePath?series=<key>` link per club series (all series, FR-009); the current selection is marked.
 */
export default function SeriesFilter({
  series,
  selected,
  basePath,
}: {
  series: { key: string; name: string }[];
  selected?: string;
  basePath: string;
}) {
  function item(label: string, key?: string) {
    const href = key ? `${basePath}?series=${encodeURIComponent(key)}` : basePath;
    const active = key ? selected === key : !selected;
    return (
      <Link
        key={key ?? "__all__"}
        href={href}
        aria-current={active ? "page" : undefined}
        style={{ marginRight: 12, fontWeight: active ? 600 : 400, textDecoration: "none", color: "inherit" }}
      >
        {label}
      </Link>
    );
  }
  return (
    <nav aria-label="Filter by series" style={{ padding: "8px 0", display: "flex", flexWrap: "wrap" }}>
      {item("All")}
      {series.map((s) => item(s.name, s.key))}
    </nav>
  );
}
