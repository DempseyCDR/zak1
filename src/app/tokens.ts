// Feature 045 (P7-R1): the typed, single source for event-type color coding that later public pages
// (P7-R4 schedule/cards) consume. Values reference the CSS custom properties defined in globals.css — no
// hex is duplicated here, so there is nothing to drift.
//
// USAGE: these are ACCENT tokens — borders, chips, bold/large labels (the 3:1 UI contrast threshold), NOT
// backgrounds behind normal-size body text. In particular `--type-meeting` (#9b84ce) is 3.48:1 with the
// text color, so it must not sit behind normal text (research R3 / contracts/design-tokens.md §4).

export type EventType = "contra" | "english" | "special" | "assembly" | "meeting";

export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  contra: "var(--type-contra)",
  english: "var(--type-english)",
  special: "var(--type-special)",
  assembly: "var(--type-assembly)",
  meeting: "var(--type-meeting)",
};
