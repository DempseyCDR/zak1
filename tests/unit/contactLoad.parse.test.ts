import { describe, it, expect } from "vitest";
import { parseIcontact } from "@/server/domain/contactLoad/parseIcontact";
import { parseMemberSheet } from "@/server/domain/contactLoad/parseMemberSheet";
import { parsePayerSheet } from "@/server/domain/contactLoad/parsePayerSheet";
import { mapConsentTopics } from "@/server/domain/contactLoad/mapConsent";
import {
  parseProviderDate,
  parseExpiryDate,
  parseYearish,
} from "@/server/domain/contactLoad/dates";
import { buildRoster } from "@/server/domain/contactLoad/buildRoster";

const IC_HEADER =
  "email,fname,lname,phone,setdate,contra,english,openband,specialevents,janeaustenball,ic:lastopendate,ic:lastclickdate";

describe("dates", () => {
  it("parses the two iContact datetime formats and rejects junk", () => {
    expect(parseProviderDate("2008-11-08 10:46:21", "ymd")?.toISOString()).toBe(
      "2008-11-08T10:46:21.000Z",
    );
    expect(parseProviderDate("08-18-2026 23:52:45", "mdy")?.toISOString()).toBe(
      "2026-08-18T23:52:45.000Z",
    );
    expect(parseProviderDate("", "ymd")).toBeNull();
    expect(parseProviderDate("not a date", "mdy")).toBeNull();
  });

  it("parses M/D/YY expiry and strips the comma-year artifact", () => {
    expect(parseExpiryDate("9/1/25")).toBe("2025-09-01");
    expect(parseExpiryDate("12/31/2026")).toBe("2026-12-31");
    expect(parseExpiryDate("")).toBeNull();
    expect(parseYearish("2,022")).toBe(2022);
    expect(parseYearish("GFSR")).toBeNull();
  });
});

describe("mapConsentTopics", () => {
  it("always includes contact_tracing; flags only add", () => {
    expect(mapConsentTopics(null)).toEqual(["contact_tracing"]);
    expect(
      mapConsentTopics({
        contra: true,
        english: false,
        openband: false,
        specialevents: true,
        janeAustenBall: true,
      }),
    ).toEqual(["contact_tracing", "contra", "special_events", "jane_austen_ball"]);
  });
});

describe("parseIcontact", () => {
  it("treats 1 as subscribed and blank/-1 identically as not", () => {
    const csv = `${IC_HEADER}
a@x.com,Ann,Lee,,2008-11-08 10:46:21,1,,,,,,
b@x.com,Bo,Fabinski,,2008-11-08 10:46:21,1,-1,1,1,"2,025",08-20-2026 10:30:13,06-24-2026 8:50:41`;
    const rows = parseIcontact(csv);
    expect(rows[0]!.flags).toMatchObject({ contra: true, english: false });
    // english=-1 is the same as blank → not subscribed
    expect(rows[1]!.flags).toMatchObject({
      contra: true,
      english: false,
      openband: true,
      specialevents: true,
      janeAustenBall: true,
    });
    expect(rows[1]!.providerLastOpen?.toISOString()).toBe("2026-08-20T10:30:13.000Z");
  });

  it("keeps a nameless row (email present) and lowercases the email", () => {
    const csv = `${IC_HEADER}
BROOKS@X.COM,,,,2008-11-08 10:46:21,1,,,,,,`;
    const rows = parseIcontact(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.email).toBe("brooks@x.com");
    expect(rows[0]!.firstName).toBeNull();
  });

  it("strips the bracketed header names of a real iContact export", () => {
    const csv = `[email],[fname],[lname],[phone],[setdate],[contra],[english],[openband],[specialevents],[janeaustenball],[ic:lastopendate],[ic:lastclickdate]
z@x.com,Zoe,Ray,,2008-11-08 10:46:21,1,,,,,,`;
    const rows = parseIcontact(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.email).toBe("z@x.com");
    expect(rows[0]!.flags.contra).toBe(true);
  });

  it("throws on a missing required column and on an invalid email", () => {
    expect(() => parseIcontact("email,fname\nz@x.com,Z")).toThrow(/missing column/i);
    const csv = `${IC_HEADER}
not-an-email,Z,Z,,2008-11-08 10:46:21,1,,,,,,`;
    expect(() => parseIcontact(csv)).toThrow(/invalid email/i);
  });
});

describe("parseMemberSheet", () => {
  it("reads volunteer flag, blank email → null, and button name", () => {
    const csv = `First Name,Last Name,Button Name,Pronouns,Volunteer,Payer,Email,Phone
Alene,Boyar,Alene,,Yes,A Boyar,ALENEB@X.COM,585-377-1805
Aster,Cummins,Aster,They/Them,No,A Cummins,,`;
    const rows = parseMemberSheet(csv);
    expect(rows[0]).toMatchObject({ firstName: "Alene", volunteer: true, email: "aleneb@x.com" });
    expect(rows[1]).toMatchObject({ volunteer: false, email: null, pronouns: "They/Them" });
  });
});

describe("parsePayerSheet", () => {
  it("lowercases Level, parses expiry, and rejects an unknown level", () => {
    const csv = `ID,Payer Name,Expires,Level
A Boyar,Alene Boyar,9/1/26,Family
T Hunt,Timothy Hunt,9/1/25,Individual`;
    const rows = parsePayerSheet(csv);
    expect(rows[0]).toMatchObject({ key: "A Boyar", level: "family", expires: "2026-09-01" });
    expect(rows[1]!.level).toBe("individual");
    expect(() => parsePayerSheet(`ID,Payer Name,Expires,Level\nX,X,9/1/25,Platinum`)).toThrow(
      /unknown level/i,
    );
  });
});

describe("buildRoster", () => {
  it("lets the Member sheet win identity and folds iContact email+consent onto the same person", () => {
    const icontact = parseIcontact(
      `${IC_HEADER}\njane@x.com,J,Knoeck,,2008-11-08 10:46:21,1,1,,,,,`,
    );
    const members = parseMemberSheet(
      `First Name,Last Name,Button Name,Pronouns,Volunteer,Payer,Email,Phone
Jane,Knoeck,,She/Her,Yes,J Knoeck,jane@x.com,`,
    );
    const roster = buildRoster(icontact, members);
    expect(roster).toHaveLength(1);
    const c = roster[0]!;
    expect(c.firstName).toBe("Jane"); // Member wins over iContact's "J"
    expect(c.pronouns).toBe("She/Her");
    expect(c.isVolunteer).toBe(true);
    expect(c.emails[0]!.consentTopics).toEqual(["contact_tracing", "contra", "english"]);
  });

  it("merges two iContact rows for one person (different emails, same name) into one contact", () => {
    const icontact = parseIcontact(
      `${IC_HEADER}
sam@x.com,Sam,Reed,,2008-11-08 10:46:21,1,,,,,,
sam2@x.com,Sam,Reed,,2008-11-08 10:46:21,,1,,,,,`,
    );
    const roster = buildRoster(icontact, []);
    expect(roster).toHaveLength(1);
    expect(roster[0]!.emails.map((e) => e.email).sort()).toEqual(["sam2@x.com", "sam@x.com"]);
  });

  it("flags a nameless iContact row and a combined 'Hilary & Ed' record for review", () => {
    const icontact = parseIcontact(
      `${IC_HEADER}
brooks@x.com,,,,2008-11-08 10:46:21,1,,,,,,
hilary@x.com,Hilary & Ed,Gutman,,2008-11-08 10:46:21,1,,,,,,`,
    );
    const roster = buildRoster(icontact, []);
    const brooks = roster.find((c) => c.emails.some((e) => e.email === "brooks@x.com"))!;
    const combined = roster.find((c) => c.emails.some((e) => e.email === "hilary@x.com"))!;
    expect(brooks.needsReview).toBe(true);
    expect(brooks.firstName).toBe("brooks"); // derived from email local part
    expect(combined.needsReview).toBe(true);
  });

  it("gives a member-only email contact_tracing only", () => {
    const roster = buildRoster(
      [],
      parseMemberSheet(
        `First Name,Last Name,Button Name,Pronouns,Volunteer,Payer,Email,Phone\nMo,Green,,,No,,mo@x.com,`,
      ),
    );
    expect(roster[0]!.emails[0]!.consentTopics).toEqual(["contact_tracing"]);
  });
});
