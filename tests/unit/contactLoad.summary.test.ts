import { describe, it, expect } from "vitest";
import { formatSummary } from "@/server/domain/contactLoad/summary";
import { emptyCounts } from "@/server/domain/contactLoad/loadPlan";

describe("formatSummary", () => {
  it("renders counts, level breakdown, and performer buckets", () => {
    const counts = emptyCounts();
    counts.retained = 2;
    counts.removed = 40;
    counts.contactsCreated = 100;
    counts.contactsUpdated = 1;
    counts.needsReview = 3;
    counts.emailsCreated = 120;
    counts.membershipsCreated = 5;
    counts.membershipsByLevel = { individual: 2, family: 1, supporter: 1, student: 1 };
    counts.volunteersSet = 7;
    counts.performerAuto = 4;
    counts.performerAmbiguous = 1;
    counts.performerUnmatched = 2;
    const resolution = {
      auto: [],
      ambiguous: [
        { performerId: "p1", displayName: "The Doe Band", candidateContactIds: ["a", "b"] },
      ],
      unmatched: [
        { performerId: "p2", displayName: "Mystery Caller" },
        { performerId: "p3", displayName: "Unknown Fiddler" },
      ],
    };

    const committed = formatSummary(counts, resolution, {
      committed: true,
      backupPath: "tmp/contact-load-x.dump",
    });
    expect(committed).toContain("[COMMITTED]");
    expect(committed).toContain("contacts removed:     40");
    expect(committed).toContain("individual 2, family 1, supporter 1, student 1");
    expect(committed).toContain("auto 4, ambiguous 1, unmatched 2");
    expect(committed).toContain("ambiguous performers: The Doe Band");
    expect(committed).toContain("unmatched performers: Mystery Caller, Unknown Fiddler");
    expect(committed).toContain("tmp/contact-load-x.dump");

    const dry = formatSummary(
      emptyCounts(),
      { auto: [], ambiguous: [], unmatched: [] },
      {
        committed: false,
      },
    );
    expect(dry).toContain("[DRY RUN]");
    expect(dry).toContain("(none — dry run)");
  });
});
