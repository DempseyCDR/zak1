import type { ReactNode } from "react";

export const metadata = {
  title: "CDR Platform",
  description: "Contacts & Membership",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>{children}</body>
    </html>
  );
}
