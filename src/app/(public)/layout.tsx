import type { ReactNode } from "react";
import Link from "next/link";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <header style={{ borderBottom: "1px solid #ddd", padding: "12px 24px" }}>
        <Link
          href="/whats-on"
          style={{ fontWeight: 600, textDecoration: "none", color: "inherit" }}
        >
          Country Dancers of Rochester
        </Link>
      </header>
      {children}
    </div>
  );
}
