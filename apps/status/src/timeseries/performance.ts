import { queryRows } from './influx.js';

const MINUTE_MS = 1000 * 60;
const DEFAULT_RANGE_MS = MINUTE_MS * 60;
const DEFAULT_SEED_LOOKBACK_MS = MINUTE_MS * 60 * 24;
// The query reads every status point in its range, so the range can't be left open-ended.
const MAX_RANGE_MS = MINUTE_MS * 60 * 24 * 31;
// Every open status board asks for the same thing, so one answer serves them all for a while.
const CACHE_MS = MINUTE_MS;

/** The range asked for can't be used, which is the caller's mistake rather than a failure. */
export class InvalidRangeError extends Error {}

const cache = new Map<string, { expires: number; rows: Promise<DepartmentPerformanceRow[]> }>();

export interface DepartmentPerformanceRow {
  department: string;
  greenPercent: number;
}

export interface DepartmentPerformanceRange {
  from?: Date;
  to?: Date;
}

function escapeSqlString(value: string): string {
  return value.replaceAll("'", "''");
}

function toTimestampLiteral(value: Date): string {
  return `TIMESTAMP '${escapeSqlString(value.toISOString())}'`;
}

function toPercent(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

/** Rounded down to the minute, so requests made close together ask for the same range. */
function toMinute(value: Date): Date {
  return new Date(Math.floor(value.getTime() / MINUTE_MS) * MINUTE_MS);
}

function resolveRange(range: DepartmentPerformanceRange): Required<DepartmentPerformanceRange> {
  const to = toMinute(range.to ?? new Date());
  const from = range.from ? toMinute(range.from) : new Date(to.getTime() - DEFAULT_RANGE_MS);

  if (from > to) {
    throw new InvalidRangeError('Invalid time range: "from" must be before "to"');
  }
  if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
    throw new InvalidRangeError('Invalid time range: it can be 31 days at most');
  }

  return { from, to };
}

function getSeedLookbackMs(): number {
  const configuredHours = Number(process.env.INFLUX_PERFORMANCE_SEED_LOOKBACK_HOURS);
  if (Number.isFinite(configuredHours) && configuredHours > 0) {
    return configuredHours * 1000 * 60 * 60;
  }

  return DEFAULT_SEED_LOOKBACK_MS;
}

/** Development doesn't write status points, so it reads production's unless told otherwise. */
function getInfluxReadTag(): string {
  return process.env.INFLUX_READ_TAG || 'prod';
}

function buildDepartmentPerformanceQuery(range: Required<DepartmentPerformanceRange>): string {
  const dev = getInfluxReadTag();
  const seedWindowStart = new Date(range.from.getTime() - getSeedLookbackMs());

  return `
WITH prior_states AS (
  SELECT
    id,
    department,
    time,
    state
  FROM (
    SELECT
      id,
      department,
      time,
      state,
      ROW_NUMBER() OVER (
        PARTITION BY id
        ORDER BY time DESC
      ) AS row_num
    FROM status
    WHERE dev = '${escapeSqlString(dev)}'
      AND department IS NOT NULL
      AND department != ''
      AND time >= ${toTimestampLiteral(seedWindowStart)}
      AND time < ${toTimestampLiteral(range.from)}
  ) seeded_states
  WHERE row_num = 1
),
window_states AS (
  SELECT
    id,
    department,
    time,
    state
  FROM status
  WHERE dev = '${escapeSqlString(dev)}'
    AND department IS NOT NULL
    AND department != ''
    AND time >= ${toTimestampLiteral(range.from)}
    AND time <= ${toTimestampLiteral(range.to)}
),
states AS (
    SELECT
    id,
        department,
        time,
        state,
        LEAD(time) OVER (
      PARTITION BY id
            ORDER BY time
        ) AS next_time
  FROM (
    SELECT id, department, time, state FROM prior_states
    UNION ALL
    SELECT id, department, time, state FROM window_states
  ) candidate_states
),
durations AS (
    SELECT
    id,
        department,
        state,
        EXTRACT(
            EPOCH FROM (
        (
          CASE
            WHEN next_time IS NULL OR next_time > ${toTimestampLiteral(range.to)}
            THEN ${toTimestampLiteral(range.to)}
            ELSE next_time
          END
        ) - (
          CASE
            WHEN time < ${toTimestampLiteral(range.from)}
            THEN ${toTimestampLiteral(range.from)}
            ELSE time
          END
        )
            )
        ) AS duration_seconds
    FROM states
  WHERE (
    CASE
      WHEN next_time IS NULL OR next_time > ${toTimestampLiteral(range.to)}
      THEN ${toTimestampLiteral(range.to)}
      ELSE next_time
    END
  ) > (
    CASE
      WHEN time < ${toTimestampLiteral(range.from)}
      THEN ${toTimestampLiteral(range.from)}
      ELSE time
    END
  )
),
device_rates AS (
    SELECT
    id,
        department,
        SUM(
            CASE
                WHEN state = 'green'
                THEN duration_seconds
                ELSE 0
            END
    ) AS green_seconds,
    SUM(
      CASE
        WHEN state != 'offline'
        THEN duration_seconds
        ELSE 0
      END
    ) AS online_seconds
    FROM durations
  GROUP BY department, id
)
SELECT
    department,
  COALESCE(AVG(100.0 * green_seconds / online_seconds), 0) AS green_percent
FROM device_rates
WHERE online_seconds > 0
GROUP BY department
ORDER BY department;
`.trim();
}

export function getDepartmentPerformance(
  range: DepartmentPerformanceRange = {},
): Promise<DepartmentPerformanceRow[]> {
  const resolvedRange = resolveRange(range);
  const key = `${resolvedRange.from.getTime()}-${resolvedRange.to.getTime()}`;
  const now = Date.now();

  for (const [cachedKey, cached] of cache) {
    if (cached.expires <= now) cache.delete(cachedKey);
  }

  let entry = cache.get(key);
  if (!entry) {
    const rows = queryDepartmentPerformance(resolvedRange);
    // A failure is passed on to this caller, but the next one should try again.
    rows.catch(() => cache.delete(key));
    entry = { expires: now + CACHE_MS, rows };
    cache.set(key, entry);
  }
  return entry.rows;
}

async function queryDepartmentPerformance(
  range: Required<DepartmentPerformanceRange>,
): Promise<DepartmentPerformanceRow[]> {
  const rows = await queryRows(buildDepartmentPerformanceQuery(range));

  return rows.map((row) => ({
    department: typeof row.department === 'string' ? row.department : 'Unassigned',
    greenPercent: toPercent(row.green_percent),
  }));
}
