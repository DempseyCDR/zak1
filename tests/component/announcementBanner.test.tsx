// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AnnouncementBanner from "@/app/(public)/_components/AnnouncementBanner";
import type { PublicAnnouncement } from "@/server/domain/announcements/announcementService";

// Feature 056 (P7-R13, jsdom): the banner renders its text + urgency role + a safe outbound link, and the
// dismiss button hides it and remembers the announcement id (a matching id hides on mount; a different id does
// not). The (public) layout owns the empty case (it renders the banner only when an announcement is active),
// so the component is always given a non-null PublicAnnouncement.

const DISMISS_KEY = "cdr.announcement.dismissed";

const info: PublicAnnouncement = {
  id: "ann-1",
  text: "Community dance moved to the Gym",
  level: "info",
  link: { label: "More info", url: "https://cdrochester.org/news" },
};

const urgent: PublicAnnouncement = {
  id: "ann-2",
  text: "Tonight's dance is CANCELLED — icy roads",
  level: "urgent",
  link: null,
};

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("AnnouncementBanner — render (US1)", () => {
  it("renders the announcement text", () => {
    render(<AnnouncementBanner announcement={info} />);
    expect(screen.getByText("Community dance moved to the Gym")).toBeTruthy();
  });

  it("uses role=status + aria-live=polite for info", () => {
    render(<AnnouncementBanner announcement={info} />);
    const region = screen.getByRole("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
  });

  it("uses role=alert for urgent", () => {
    render(<AnnouncementBanner announcement={urgent} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("renders a safe outbound link (target=_blank rel=noopener noreferrer)", () => {
    render(<AnnouncementBanner announcement={info} />);
    const link = screen.getByRole("link", { name: "More info" });
    expect(link.getAttribute("href")).toBe("https://cdrochester.org/news");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("renders no link when none is set", () => {
    render(<AnnouncementBanner announcement={urgent} />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("AnnouncementBanner — dismiss (US3)", () => {
  it("dismiss hides the banner and stores the announcement id", async () => {
    render(<AnnouncementBanner announcement={info} />);
    await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByText(info.text)).toBeNull();
    expect(localStorage.getItem(DISMISS_KEY)).toBe("ann-1");
  });

  it("dismiss button is keyboard-operable", async () => {
    render(<AnnouncementBanner announcement={info} />);
    const btn = screen.getByRole("button", { name: /dismiss/i });
    btn.focus();
    await userEvent.keyboard("{Enter}");
    expect(screen.queryByText(info.text)).toBeNull();
  });

  it("hides on mount when a stored dismissal matches the current id", () => {
    localStorage.setItem(DISMISS_KEY, "ann-1");
    render(<AnnouncementBanner announcement={info} />);
    expect(screen.queryByText(info.text)).toBeNull();
  });

  it("still shows when the stored dismissal is for a DIFFERENT announcement", () => {
    localStorage.setItem(DISMISS_KEY, "some-old-id");
    render(<AnnouncementBanner announcement={info} />);
    expect(screen.getByText(info.text)).toBeTruthy();
  });
});
