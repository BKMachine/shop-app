// Shared pieces of the stock and cost graphs drawn from audits (materials, parts, tools).
import { DateTime } from 'luxon';

export interface GraphPoint {
  x: number;
  y: number;
}

export const graphRanges = [
  { title: '1 month', value: 1 },
  { title: '3 months', value: 3 },
  { title: '6 months', value: 6 },
  { title: '1 year', value: 12 },
  { title: '3 years', value: 36 },
];

const millis = (audit: Audit) => DateTime.fromISO(audit.timestamp).toMillis();

// Points for a stepped line from `from` to `to`. The server sends the latest audit before the range
// first, then the audits in it. The line starts at `from` with the value in effect then: that earlier
// audit's, else the first change's old value, else the first value of an item created in the range,
// drawn back to `from`. Each change in the range keeps its own time, and the line ends at `to` on the
// current value. Changes are compared with the point before them rather than their own old value,
// which goes stale when a backfilled audit is inserted ahead of them.
export function stepPoints(
  audits: Audit[],
  from: DateTime,
  to: DateTime,
  current: number,
  value: (doc: Record<string, unknown>) => unknown,
): GraphPoint[] {
  const read = (doc: Record<string, unknown> | null | undefined) => {
    const v = doc ? value(doc) : null;
    return v == null ? null : Number(v);
  };
  const start = from.toMillis();
  const sorted = [...audits].sort((a, b) => millis(a) - millis(b));
  const before = sorted.filter((audit) => millis(audit) < start);
  const inRange = sorted.filter((audit) => millis(audit) >= start);
  const first = inRange[0];

  const opening =
    read(before[before.length - 1]?.new) ?? read(first?.old) ?? read(first?.new) ?? current;
  const points: GraphPoint[] = [{ x: start, y: opening }];
  for (const audit of inRange) {
    const y = read(audit.new);
    if (y === null || y === points[points.length - 1]?.y) continue;
    points.push({ x: millis(audit), y });
  }
  points.push({ x: to.toMillis(), y: current });
  return points;
}

// The time axis for a range: day ticks up to six months, month ticks with the year beyond that.
export function timeScale(from: DateTime, to: DateTime) {
  const long = to.diff(from, 'months').months > 6;
  return {
    type: 'time' as const,
    min: from.toMillis(),
    max: to.toMillis(),
    time: {
      tooltipFormat: 'D t',
      unit: long ? ('month' as const) : ('day' as const),
      displayFormats: {
        day: 'L/d',
        month: 'L/yy',
      },
    },
  };
}
