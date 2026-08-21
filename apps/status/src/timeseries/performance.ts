import { queryRows } from './influx.js';

const DEFAULT_RANGE_MS = 1000 * 60 * 60;
const DEFAULT_SEED_LOOKBACK_MS = 1000 * 60 * 60 * 24;

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

function resolveRange(range: DepartmentPerformanceRange): Required<DepartmentPerformanceRange> {
  const to = range.to ?? new Date();
  const from = range.from ?? new Date(to.getTime() - DEFAULT_RANGE_MS);

  if (from > to) {
    throw new Error('Invalid time range: "from" must be before "to"');
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

function getInfluxReadTag(): string {
  if (process.env.INFLUX_READ_TAG) {
    return process.env.INFLUX_READ_TAG;
  }

  return process.env.NODE_ENV === 'production' ? 'prod' : 'prod';
}

function buildDepartmentPerformanceQuery(range: Required<DepartmentPerformanceRange>): string {
  const dev = getInfluxReadTag();
  const seedWindowStart = new Date(range.from.getTime() - getSeedLookbackMs());

  return `
WITH prior_states AS (
  SELECT
    name,
    department,
    time,
    state
  FROM (
    SELECT
      name,
      department,
      time,
      state,
      ROW_NUMBER() OVER (
        PARTITION BY name
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
    name,
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
    name,
        department,
        time,
        state,
        LEAD(time) OVER (
      PARTITION BY name
            ORDER BY time
        ) AS next_time
  FROM (
    SELECT name, department, time, state FROM prior_states
    UNION ALL
    SELECT name, department, time, state FROM window_states
  ) candidate_states
),
durations AS (
    SELECT
    name,
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
    name,
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
  GROUP BY department, name
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

export async function getDepartmentPerformance(
  range: DepartmentPerformanceRange = {},
): Promise<DepartmentPerformanceRow[]> {
  const resolvedRange = resolveRange(range);
  const rows = await queryRows(buildDepartmentPerformanceQuery(resolvedRange));

  return rows.map((row) => ({
    department: typeof row.department === 'string' ? row.department : 'Unassigned',
    greenPercent: toPercent(row.green_percent),
  }));
}
