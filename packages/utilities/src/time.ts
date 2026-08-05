import { DateTime } from 'luxon';

export const DEFAULT_BUSINESS_TIME_ZONE = 'America/Denver';
export const DEFAULT_BUSINESS_START_HOUR = 8;
export const DEFAULT_BUSINESS_END_HOUR = 17;

type BusinessDurationInput = string | Date | null | undefined;

type TaskDurationInput = {
  startedAt: BusinessDurationInput;
  endedAt?: BusinessDurationInput;
};

export type BusinessDurationOptions = {
  timeZone?: string;
  startHour?: number;
  endHour?: number;
};

export function calculateBusinessDurationMs(
  start: BusinessDurationInput,
  end: BusinessDurationInput,
  options: BusinessDurationOptions = {},
) {
  if (!start || !end) return 0;

  const timeZone = options.timeZone || DEFAULT_BUSINESS_TIME_ZONE;
  const startHour = options.startHour ?? DEFAULT_BUSINESS_START_HOUR;
  const endHour = options.endHour ?? DEFAULT_BUSINESS_END_HOUR;

  let cursor = DateTime.fromJSDate(normalizeDate(start), { zone: timeZone });
  const finish = DateTime.fromJSDate(normalizeDate(end), { zone: timeZone });

  if (finish <= cursor) return 0;

  let total = 0;

  while (cursor < finish) {
    if (cursor.weekday > 5) {
      cursor = nextBusinessDayStart(cursor, startHour);
      continue;
    }

    const dayStart = cursor.set({
      hour: startHour,
      minute: 0,
      second: 0,
      millisecond: 0,
    });
    const dayEnd = cursor.set({
      hour: endHour,
      minute: 0,
      second: 0,
      millisecond: 0,
    });

    const intervalStart = cursor > dayStart ? cursor : dayStart;
    const intervalEnd = finish < dayEnd ? finish : dayEnd;

    if (intervalEnd > intervalStart) {
      total += intervalEnd.diff(intervalStart).as('milliseconds');
    }

    cursor = nextBusinessDayStart(dayStart, startHour);
  }

  return Math.max(0, Math.round(total));
}

export function calculateTaskBusinessDurationMs(
  task: TaskDurationInput,
  options: BusinessDurationOptions = {},
  fallbackEnd: BusinessDurationInput = null,
) {
  return calculateBusinessDurationMs(task.startedAt, task.endedAt ?? fallbackEnd, options);
}

function normalizeDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value);
}

function nextBusinessDayStart(value: DateTime, startHour: number) {
  let next = value.plus({ days: 1 }).startOf('day');
  while (next.weekday > 5) {
    next = next.plus({ days: 1 });
  }

  return next.set({
    hour: startHour,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
}
