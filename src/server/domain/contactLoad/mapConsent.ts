import type { EmailConsentTopic } from "@/server/db/schema";
import type { IcontactListFlags } from "./loadPlan";

// Feature 044 (FR-005/006/007) — iContact list flags → consent topics. Pure.
//
// Every loaded email gets `contact_tracing` UNCONDITIONALLY (operator decision); the per-list flags only
// ever ADD topics. A member-only email (no iContact row, so no flags) therefore carries `contact_tracing`
// alone. `-1` and blank are both "not subscribed" and are resolved to `false` upstream in the parser.
const FLAG_TOPIC: Array<[keyof IcontactListFlags, EmailConsentTopic]> = [
  ["contra", "contra"],
  ["english", "english"],
  ["openband", "openband"],
  ["specialevents", "special_events"],
  ["janeAustenBall", "jane_austen_ball"],
];

export function mapConsentTopics(flags?: IcontactListFlags | null): EmailConsentTopic[] {
  const topics: EmailConsentTopic[] = ["contact_tracing"];
  if (flags) {
    for (const [key, topic] of FLAG_TOPIC) {
      if (flags[key]) topics.push(topic);
    }
  }
  return topics;
}
