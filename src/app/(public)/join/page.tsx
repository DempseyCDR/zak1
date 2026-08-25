import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { clubSettings } from "@/server/db/schema";
import { membershipYearLabel } from "@/server/domain/org/membershipYear";
import { grantedMembershipExpiry } from "@/server/domain/membership/membershipTerm";
import Container from "../_components/Container";
import MembershipTiers from "../_components/MembershipTiers";
import DonateButton from "../_components/DonateButton";
import JoinForm from "./JoinForm";

/**
 * Feature 055 (P7-R12): the content-complete membership page. A server component that reads the club setting
 * and single-sources the membership year + the coverage-through date (via the shared `grantedMembershipExpiry`,
 * which grants the 2-month early-renewal grace — the same calc enrollment uses). The interactive capture +
 * PayPal handoff (feature 019) is the client `<JoinForm>`, unchanged.
 */
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function humanDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d}, ${y}`;
}

export default async function JoinPage() {
  const settings = await db.query.clubSettings.findFirst({ where: eq(clubSettings.id, 1) });
  const boundary = settings?.membershipYearEnd ?? "08-31";
  const yearLabel = membershipYearLabel(boundary);
  const today = new Date().toISOString().slice(0, 10);
  const coverageThrough = humanDate(grantedMembershipExpiry(today, boundary));

  return (
    <Container width="narrow">
      <h1>Become a member</h1>
      <p>
        Your membership sustains the Country Dancers of Rochester — the callers, bands, halls, and
        the community that keeps contra and English dancing alive here.
      </p>

      <MembershipTiers yearLabel={yearLabel} coverageThrough={coverageThrough} />

      <JoinForm />

      <p>
        Prefer to give a one-time gift instead of (or in addition to) joining? <DonateButton />
      </p>
    </Container>
  );
}
