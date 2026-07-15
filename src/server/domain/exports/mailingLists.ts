import type { EmailConsentTopic } from "@/server/db/schema";
import type { ListId } from "@/server/validation/exports";

export type MailingListKind = "topic" | "derived";

export type MailingListDef = {
  id: ListId;
  kind: MailingListKind;
  /** Only set for topic lists (FR-001a). */
  consentTopic?: EmailConsentTopic;
  filename: string;
};

export const MAILING_LISTS: MailingListDef[] = [
  { id: "contra", kind: "topic", consentTopic: "contra", filename: "contra.csv" },
  { id: "english", kind: "topic", consentTopic: "english", filename: "english.csv" },
  { id: "openband", kind: "topic", consentTopic: "openband", filename: "openband.csv" },
  {
    id: "specialevents",
    kind: "topic",
    consentTopic: "special_events",
    filename: "specialevents.csv",
  },
  { id: "performer", kind: "derived", filename: "performer.csv" },
  { id: "member", kind: "derived", filename: "member.csv" },
];

export function getMailingListDef(listId: ListId): MailingListDef {
  const def = MAILING_LISTS.find((l) => l.id === listId);
  if (!def) throw new Error(`unknown mailing list: ${listId}`);
  return def;
}
