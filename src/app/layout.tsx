import type { ReactNode } from "react";
import PublicNav from "./PublicNav";

export const metadata = {
  title: "CDR Platform",
  description: "Contacts & Membership",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        {/* Feature 034 (P6-R1): the public menu is the topmost bar on EVERY page (public + admin +
            door). On staff pages the volunteer <Nav/> renders beneath it, from the group layouts. */}
        <PublicNav />
        {children}
      </body>
    </html>
  );
}
