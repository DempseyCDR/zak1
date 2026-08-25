// Feature 055 (P7-R12): the committed club-role registry — the single source for both org pages. The contact
// directory lists role→alias from here; the board page shows each board-seat role with its designated contact's
// name + this alias. Display `order` is the ROLE's board order (registry-owned, not per-assignment).
// NOTE: reconcile the exact roster/aliases with audit §data-6 before rollout; editing is a one-line change here.

export type ClubRole = {
  key: string; // stable id (snake_case), e.g. "vice_president"
  roleName: string; // display, e.g. "Vice President"
  emailAlias: string; // role address, e.g. "vicepresident@cdrochester.org"
  isBoardSeat: boolean; // true → listed on the board page with its officer
  order: number; // board/display order (unique)
};

export const CLUB_ROLES: readonly ClubRole[] = [
  {
    key: "president",
    roleName: "President",
    emailAlias: "president@cdrochester.org",
    isBoardSeat: true,
    order: 1,
  },
  {
    key: "vice_president",
    roleName: "Vice President",
    emailAlias: "vicepresident@cdrochester.org",
    isBoardSeat: true,
    order: 2,
  },
  {
    key: "treasurer",
    roleName: "Treasurer",
    emailAlias: "treasurer@cdrochester.org",
    isBoardSeat: true,
    order: 3,
  },
  {
    key: "secretary",
    roleName: "Secretary",
    emailAlias: "secretary@cdrochester.org",
    isBoardSeat: true,
    order: 4,
  },
  {
    key: "contra_booking",
    roleName: "Contra Booking",
    emailAlias: "contrabooking@cdrochester.org",
    isBoardSeat: true,
    order: 5,
  },
  {
    key: "english_booking",
    roleName: "English Booking",
    emailAlias: "englishbooking@cdrochester.org",
    isBoardSeat: true,
    order: 6,
  },
  {
    key: "webmaster",
    roleName: "Webmaster",
    emailAlias: "webmaster@cdrochester.org",
    isBoardSeat: true,
    order: 7,
  },
  // A non-board general contact alias (exercises the isBoardSeat distinction; shown in the directory only).
  {
    key: "info",
    roleName: "General inquiries",
    emailAlias: "info@cdrochester.org",
    isBoardSeat: false,
    order: 8,
  },
];

export const BOARD_ROLES: readonly ClubRole[] = CLUB_ROLES.filter((r) => r.isBoardSeat).sort(
  (a, b) => a.order - b.order,
);

export function isRoleKey(k: string): boolean {
  return CLUB_ROLES.some((r) => r.key === k);
}

export function isBoardRoleKey(k: string): boolean {
  return CLUB_ROLES.some((r) => r.key === k && r.isBoardSeat);
}
