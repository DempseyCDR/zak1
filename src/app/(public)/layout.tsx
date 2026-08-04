import type { ReactNode } from "react";

/**
 * Public route-group layout.
 *
 * The site header/wordmark now lives in the root-layout <PublicNav/> (feature 034, P6-R1), which renders
 * on every page — so this layout is a pass-through. Kept as the home for any future public-only chrome.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
