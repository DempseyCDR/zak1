/** Quarterly aggregation (pure). Calendar quarters in Phase 1 (FR-010). Amounts in dollars. */

export type Fyi = {
  donations: number;
  memberships: number;
  futureEvent: number;
  giftCards: number;
  miscSales: number;
};

export type QuarterlyRow = {
  date: string; // YYYY-MM-DD
  dancers: number;
  gross: number;
  merchandise: number;
  rent: number;
  performerTotal: number;
  ongoing: number;
  misc: number;
  danceNet: number;
  avgTicket: number;
  fyi: Fyi;
};

export type Bucket = {
  count: number;
  avgDancers: number;
  avgGross: number;
  avgMerchandise: number;
  avgRent: number;
  avgPerformerTotal: number;
  avgOngoing: number;
  avgMisc: number;
  avgDanceNet: number;
  avgTicket: number;
  fyi: Fyi;
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const zeroFyi = (): Fyi => ({ donations: 0, memberships: 0, futureEvent: 0, giftCards: 0, miscSales: 0 });

function bucket(rows: QuarterlyRow[]): Bucket {
  const n = rows.length;
  const avg = (sel: (r: QuarterlyRow) => number) => (n === 0 ? 0 : round2(rows.reduce((a, r) => a + sel(r), 0) / n));
  const fyi = zeroFyi();
  for (const r of rows) {
    fyi.donations += r.fyi.donations;
    fyi.memberships += r.fyi.memberships;
    fyi.futureEvent += r.fyi.futureEvent;
    fyi.giftCards += r.fyi.giftCards;
    fyi.miscSales += r.fyi.miscSales;
  }
  return {
    count: n,
    avgDancers: avg((r) => r.dancers),
    avgGross: avg((r) => r.gross),
    avgMerchandise: avg((r) => r.merchandise),
    avgRent: avg((r) => r.rent),
    avgPerformerTotal: avg((r) => r.performerTotal),
    avgOngoing: avg((r) => r.ongoing),
    avgMisc: avg((r) => r.misc),
    avgDanceNet: avg((r) => r.danceNet),
    avgTicket: avg((r) => r.avgTicket),
    fyi: { donations: round2(fyi.donations), memberships: round2(fyi.memberships), futureEvent: round2(fyi.futureEvent), giftCards: round2(fyi.giftCards), miscSales: round2(fyi.miscSales) },
  };
}

const yearOf = (d: string) => Number(d.slice(0, 4));
const quarterOf = (d: string) => Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1;

export function quarterlySummary(rows: QuarterlyRow[], year: number) {
  const inYear = rows.filter((r) => yearOf(r.date) === year);
  const quarters = [1, 2, 3, 4].map((q) => ({
    quarter: q,
    ...bucket(inYear.filter((r) => quarterOf(r.date) === q)),
  }));
  return {
    quarters,
    ytd: bucket(inYear),
    lastYear: bucket(rows.filter((r) => yearOf(r.date) === year - 1)),
  };
}
