// Feature 044 test fixtures — build the three input CSVs from concise row objects.

const IC_HEADER =
  "email,fname,lname,phone,setdate,contra,english,openband,specialevents,janeaustenball,ic:lastopendate,ic:lastclickdate";

export type IcRow = {
  email: string;
  fname?: string;
  lname?: string;
  phone?: string;
  setdate?: string;
  contra?: string;
  english?: string;
  openband?: string;
  specialevents?: string;
  jab?: string;
  lastopen?: string;
  lastclick?: string;
};

function csvField(v: string | undefined): string {
  const s = v ?? "";
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function icontactCsv(rows: IcRow[]): string {
  const body = rows.map((r) =>
    [
      r.email,
      r.fname,
      r.lname,
      r.phone,
      r.setdate ?? "2008-11-08 10:46:21",
      r.contra,
      r.english,
      r.openband,
      r.specialevents,
      r.jab,
      r.lastopen,
      r.lastclick,
    ]
      .map(csvField)
      .join(","),
  );
  return [IC_HEADER, ...body].join("\n");
}

const MEMBER_HEADER = "First Name,Last Name,Button Name,Pronouns,Volunteer,Payer,Email,Phone";

export type MemberRowFixture = {
  first: string;
  last?: string;
  button?: string;
  pronouns?: string;
  volunteer?: boolean;
  payer?: string;
  email?: string;
  phone?: string;
};

export function memberCsv(rows: MemberRowFixture[]): string {
  const body = rows.map((r) =>
    [r.first, r.last, r.button, r.pronouns, r.volunteer ? "Yes" : "No", r.payer, r.email, r.phone]
      .map(csvField)
      .join(","),
  );
  return [MEMBER_HEADER, ...body].join("\n");
}

const PAYER_HEADER = "ID,Payer Name,Date,Expires,Level,Amount,Method";

export type PayerRowFixture = { id: string; name: string; expires: string; level: string };

export function payerCsv(rows: PayerRowFixture[]): string {
  const body = rows.map((r) =>
    [r.id, r.name, "1/1/2024", r.expires, r.level, "$12.00", "Cash"].map(csvField).join(","),
  );
  return [PAYER_HEADER, ...body].join("\n");
}
