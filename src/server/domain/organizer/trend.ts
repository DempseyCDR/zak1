/**
 * Rolling trend series (pure). Charts render only when 12 ≤ weeks ≤ 53 (window capped at the most
 * recent 53 weeks); below 12 weeks the trend is null (FR-011/012).
 */
export type TrendPoint = { date: string; danceNet: number; dancers: number; caller: string; band: string };

export type Trend = {
  weeks: number;
  danceNet: { date: string; value: number; negative: boolean }[];
  danceNetTrend: { date: string; value: number }[];
  attendance: { date: string; value: number }[];
  attendanceTrend: { date: string; value: number }[];
  points: TrendPoint[];
};

const MIN_WEEKS = 12;
const MAX_WEEKS = 53;
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/** 4-event trailing rolling average of a numeric series (aligned to each point). */
function rollingAverage(values: number[], window = 4): number[] {
  return values.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    return Math.round(slice.reduce((a, v) => a + v, 0) / slice.length);
  });
}

/**
 * Build the trend from per-event points ordered ascending by date. Returns null when the data spans
 * fewer than 12 weeks; otherwise limits to events within the most recent 53 weeks.
 */
export function buildTrend(pointsAsc: TrendPoint[]): Trend | null {
  if (pointsAsc.length === 0) return null;
  const last = new Date(pointsAsc[pointsAsc.length - 1]!.date).getTime();
  const first = new Date(pointsAsc[0]!.date).getTime();
  const spanWeeks = Math.floor((last - first) / MS_PER_WEEK) + 1;
  if (spanWeeks < MIN_WEEKS) return null;

  const cutoff = last - MAX_WEEKS * MS_PER_WEEK;
  const windowed = pointsAsc.filter((p) => new Date(p.date).getTime() > cutoff);

  const netVals = windowed.map((p) => p.danceNet);
  const attVals = windowed.map((p) => p.dancers);
  const netAvg = rollingAverage(netVals);
  const attAvg = rollingAverage(attVals);

  return {
    weeks: Math.min(spanWeeks, MAX_WEEKS),
    danceNet: windowed.map((p) => ({ date: p.date, value: p.danceNet, negative: p.danceNet < 0 })),
    danceNetTrend: windowed.map((p, i) => ({ date: p.date, value: netAvg[i]! })),
    attendance: windowed.map((p) => ({ date: p.date, value: p.dancers })),
    attendanceTrend: windowed.map((p, i) => ({ date: p.date, value: attAvg[i]! })),
    points: windowed,
  };
}
