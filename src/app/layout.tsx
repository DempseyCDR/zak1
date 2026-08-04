import type { ReactNode } from "react";
import PublicNav from "./PublicNav";
import Nav from "./Nav";

export const metadata = {
  title: "CDR Platform",
  description: "Contacts & Membership",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        {/* Feature 034 (P6-R1): the public menu is the topmost bar on EVERY page. Feature 035 (P6-R2):
            the volunteer menu is the second bar, on every page when signed in (Nav returns null when
            anonymous), rendered here rather than in the (admin)/(door) layouts. */}
        <PublicNav />
        <Nav />
        {children}
      </body>
    </html>
  );
}
