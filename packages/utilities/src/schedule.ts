import { isTimedRoutingOperation } from './parts.js';
import { DEFAULT_BUSINESS_END_HOUR, DEFAULT_BUSINESS_START_HOUR } from './time.js';

// Schedule days are calendar days written as `YYYY-MM-DD` keys. They are worked out in UTC so a
// key never drifts across a timezone or daylight-saving change.

const DAY_MS = 86_400_000;
const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDayKey(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = DAY_KEY_PATTERN.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return toDayKeyUtc(date) === value;
}

function toDayKeyUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The local calendar day of `date` (today by default). */
export function dayKeyOf(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dayKeyToUtcMs(key: string): number {
  const [year, month, day] = key.split('-').map(Number);
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

export function addDays(key: string, days: number): string {
  return toDayKeyUtc(new Date(dayKeyToUtcMs(key) + days * DAY_MS));
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function diffDays(from: string, to: string): number {
  return Math.round((dayKeyToUtcMs(to) - dayKeyToUtcMs(from)) / DAY_MS);
}

/** 0 = Sunday ... 6 = Saturday. */
export function dayOfWeek(key: string): number {
  return new Date(dayKeyToUtcMs(key)).getUTCDay();
}

/** The day after the last booked day. */
export function scheduleEnd(entry: { start: string; days: number }): string {
  return addDays(entry.start, entry.days);
}

export interface SchedulePlacement {
  _id: string;
  machineId: string;
  start: string;
  days: number;
}

/**
 * Puts `placed` where it was dropped and pushes later entries on the same machine forward so no
 * two overlap. An entry it lands on goes after it when dropped before that entry's midpoint,
 * otherwise before it, so dropping onto the front half of a job inserts ahead of it. Entries only
 * ever move later; gaps that were already in the row stay.
 *
 * Returns every entry, with the ones that moved replaced.
 */
export function placeScheduleEntry<T extends SchedulePlacement>(
  entries: readonly T[],
  placed: SchedulePlacement,
): T[] {
  const existing = entries.find((entry) => entry._id === placed._id);
  const moved = { ...(existing as T), ...placed, days: Math.max(1, Math.round(placed.days)) };

  const row = entries.filter(
    (entry) => entry.machineId === moved.machineId && entry._id !== moved._id,
  );
  const origin = moved.start;
  const sortKey = (entry: T) =>
    entry._id === moved._id
      ? diffDays(origin, entry.start)
      : diffDays(origin, entry.start) + entry.days / 2;

  const ordered = [...row, moved].sort((left, right) => {
    const difference = sortKey(left) - sortKey(right);
    if (difference !== 0) return difference;
    // The entry being placed wins a tie, so it takes the spot it was dropped on.
    if (left._id === moved._id) return -1;
    if (right._id === moved._id) return 1;
    return left.start.localeCompare(right.start);
  });

  const updated = new Map<string, T>();
  let cursor: string | null = null;
  for (const entry of ordered) {
    const start: string = cursor && diffDays(entry.start, cursor) > 0 ? cursor : entry.start;
    const next = start === entry.start ? entry : { ...entry, start };
    updated.set(next._id, next);
    cursor = scheduleEnd(next);
  }

  const result = entries.map((entry) => updated.get(entry._id) ?? entry);
  if (!existing) result.push(moved);
  return result;
}

/** The entries in `after` whose machine, start or length differ from `before`. */
export function changedSchedulePlacements<T extends SchedulePlacement>(
  before: readonly T[],
  after: readonly T[],
): T[] {
  const previous = new Map(before.map((entry) => [entry._id, entry]));
  return after.filter((entry) => {
    const old = previous.get(entry._id);
    return (
      !old ||
      old.machineId !== entry.machineId ||
      old.start !== entry.start ||
      old.days !== entry.days
    );
  });
}

export type ScheduleDueTone = 'none' | 'ok' | 'tight' | 'late';

/** Days of slack at or under which a booking that still makes its due date is called tight. */
export const SCHEDULE_TIGHT_SLACK_DAYS = 3;

/**
 * How a booking sits against the job's due date: `late` finishes after it, `tight` finishes
 * within {@link SCHEDULE_TIGHT_SLACK_DAYS} days of it, `ok` has more room, `none` has no due date.
 */
export function scheduleDueTone(
  entry: { start: string; days: number },
  dueDate: string | null | undefined,
): ScheduleDueTone {
  if (!dueDate || !isDayKey(dueDate)) return 'none';
  const lastDay = addDays(entry.start, entry.days - 1);
  const slack = diffDays(lastDay, dueDate);
  if (slack < 0) return 'late';
  if (slack <= SCHEDULE_TIGHT_SLACK_DAYS) return 'tight';
  return 'ok';
}

/* ---------- Length estimates ---------- */

export const DEFAULT_SCHEDULE_UTILIZATION = 40;

export const DEFAULT_SCHEDULE_SETTINGS: ScheduleSettings = {
  workdayStartHour: DEFAULT_BUSINESS_START_HOUR,
  workdayEndHour: DEFAULT_BUSINESS_END_HOUR,
  workdays: [1, 2, 3, 4, 5],
  defaultUtilization: DEFAULT_SCHEDULE_UTILIZATION,
  departmentUtilization: {},
};

/** Percent of the working day machines in a department are actually cutting. */
export function scheduleUtilization(
  settings: ScheduleSettings,
  departmentId: string | null | undefined,
): number {
  const value = departmentId ? settings.departmentUtilization[departmentId] : undefined;
  return value != null && value > 0 ? value : settings.defaultUtilization;
}

export function isScheduleWorkday(key: string, settings: Pick<ScheduleSettings, 'workdays'>) {
  // With no working days set every day counts, rather than nothing ever fitting.
  return !settings.workdays.length || settings.workdays.includes(dayOfWeek(key));
}

interface EstimateRoutingOperation {
  department?: string | null;
  time?: number | null;
  noCycleTime?: boolean | null;
}

export interface ScheduleEstimate {
  /** qty × cycle minutes for the ops counted. */
  runMinutes: number;
  /** Cycle minutes per part that were counted. */
  cycleMinutes: number;
  /** Whether the ops counted were the machine's department's, rather than the whole routing. */
  departmentOpsOnly: boolean;
  utilization: number;
  /** Cutting minutes a machine gets through in one working day. */
  minutesPerDay: number;
  workingDays: number;
  /** Calendar days the booking spans from its start, counting the days off it crosses. */
  days: number;
}

/**
 * How long a job runs on a machine: qty × the cycle time of the part's ops in the machine's
 * department (the whole routing when none are in that department), spread over working days of
 * `workdayStartHour`–`workdayEndHour` with machines cutting `utilization` percent of the time.
 * Null when the routing has no cycle time to go on.
 */
export function estimateScheduleLength(input: {
  routing: readonly EstimateRoutingOperation[] | null | undefined;
  qty: number;
  departmentId: string | null | undefined;
  start: string;
  settings: ScheduleSettings;
}): ScheduleEstimate | null {
  const timed = (input.routing ?? []).filter(
    (operation) => isTimedRoutingOperation(operation) && Number(operation.time) > 0,
  );
  const departmentOps = input.departmentId
    ? timed.filter((operation) => operation.department === input.departmentId)
    : [];
  const counted = departmentOps.length ? departmentOps : timed;
  const cycleMinutes = counted.reduce((total, operation) => total + Number(operation.time), 0);
  const qty = Math.max(0, Number(input.qty) || 0);
  if (!(cycleMinutes > 0) || !(qty > 0)) return null;

  const { settings } = input;
  const utilization = scheduleUtilization(settings, input.departmentId);
  const hoursPerDay = Math.max(settings.workdayEndHour - settings.workdayStartHour, 1);
  const minutesPerDay = hoursPerDay * 60 * (utilization / 100);
  const runMinutes = qty * cycleMinutes;
  const workingDays = Math.max(1, Math.ceil(runMinutes / minutesPerDay));

  return {
    runMinutes,
    cycleMinutes,
    departmentOpsOnly: departmentOps.length > 0,
    utilization,
    minutesPerDay,
    workingDays,
    days: workingDaysToCalendarDays(input.start, workingDays, settings),
  };
}

/** Calendar days from `start` through the last of `workingDays` working days. */
export function workingDaysToCalendarDays(
  start: string,
  workingDays: number,
  settings: Pick<ScheduleSettings, 'workdays'>,
): number {
  let remaining = Math.max(1, Math.round(workingDays));
  let days = 0;
  while (remaining > 0) {
    if (isScheduleWorkday(addDays(start, days), settings)) remaining -= 1;
    days += 1;
  }
  return days;
}
