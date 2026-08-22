import type { ReactNode } from "react";
import { Raleway, Open_Sans } from "next/font/google";
import "./globals.css";
import PublicNav from "./PublicNav";
import Nav from "./Nav";

export const metadata = {
  title: "CDR Platform",
  description: "Contacts & Membership",
};

// Feature 045 (P7-R1): brand fonts, self-hosted via next/font (no external request, CSP-safe). Exposed as
// CSS variables consumed by globals.css (--font-heading / --font-body).
const raleway = Raleway({ subsets: ["latin"], variable: "--font-raleway", display: "swap" });
const openSans = Open_Sans({ subsets: ["latin"], variable: "--font-open-sans", display: "swap" });

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${raleway.variable} ${openSans.variable}`}>
      {/* Feature 045: styling now comes from globals.css tokens (imported above); the inline body font is
          gone. Feature 034 (P6-R1): the public menu is the topmost bar on EVERY page. Feature 035 (P6-R2):
          the volunteer menu is the second bar, on every page when signed in (Nav returns null when
          anonymous). Both bars keep their current look — PublicNav's own restyle is P7-R2. */}
      <body>
        <PublicNav />
        <Nav />
        {children}
      </body>
    </html>
  );
}
