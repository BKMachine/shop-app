import { addDays, diffDays } from '@repo/utilities/schedule';

export type ScheduleRangePreset = '1w' | '2w' | '1m' | '3m' | '6m';

interface RangePresetConfig {
  label: string;
  days: number;
  /** Days the prev/next buttons move the range. */
  step: number;
}

export const SCHEDULE_RANGE_PRESETS: Record<ScheduleRangePreset, RangePresetConfig> = {
  '1w': { label: '1W', days: 7, step: 7 },
  '2w': { label: '2W', days: 14, step: 7 },
  '1m': { label: '1M', days: 35, step: 7 },
  '3m': { label: '3M', days: 91, step: 28 },
  '6m': { label: '6M', days: 182, step: 56 },
};

export function isScheduleRangePreset(value: unknown): value is ScheduleRangePreset {
  return typeof value === 'string' && value in SCHEDULE_RANGE_PRESETS;
}

function dayKeyToDate(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
}

export function formatDay(key: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: 'UTC' }).format(
    dayKeyToDate(key),
  );
}

export function formatRangeLabel(start: string, days: number): string {
  const last = addDays(start, days - 1);
  const sameYear = start.slice(0, 4) === last.slice(0, 4);
  const startLabel = formatDay(start, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  const endLabel = formatDay(last, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startLabel} – ${endLabel}`;
}

export interface MonthSpan {
  key: string;
  label: string;
  /** Day offset from the range start. */
  offset: number;
  days: number;
}

/** The months a range crosses, clipped to the range. */
export function monthSpans(start: string, days: number): MonthSpan[] {
  const spans: MonthSpan[] = [];
  let offset = 0;
  while (offset < days) {
    const key = addDays(start, offset);
    const [year, month] = key.split('-').map(Number);
    const nextMonth = new Date(Date.UTC(year ?? 1970, month ?? 1, 1)).toISOString().slice(0, 10);
    const length = Math.min(diffDays(key, nextMonth), days - offset);
    spans.push({
      key,
      label: formatDay(key, { month: 'long', ...(length > 20 ? { year: 'numeric' } : {}) }),
      offset,
      days: length,
    });
    offset += length;
  }
  return spans;
}

/** The colour for customers that have not been given one. */
export const DEFAULT_CUSTOMER_COLOR = '#cccccc';

/** The colour a customer's jobs get: the one set on the customer, or the default. */
export function customerColor(color?: string | null): string {
  return color || DEFAULT_CUSTOMER_COLOR;
}

/** The fields a schedule tile needs from a job in the jobs list. */
export function toScheduleEntryJob(job: Job): ScheduleEntryJob {
  const customerId = typeof job.customer === 'string' ? job.customer : job.customer._id;
  const dueDate = job.dueDate ? new Date(job.dueDate).toISOString().slice(0, 10) : null;
  return {
    _id: job._id,
    jobNumber: job.jobNumber,
    customerId,
    customerName:
      job.customerName || (typeof job.customer === 'string' ? '' : job.customer.name) || '',
    partNumber: job.partNumber ?? '',
    partDescription: job.partDescription ?? '',
    qty: job.qty,
    dueDate,
    status: job.status,
    priority: job.priority ?? 'normal',
  };
}
