export function parseJobDateValue(value: unknown) {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const normalizedDate = new Date(value);
    normalizedDate.setHours(0, 0, 0, 0);
    return normalizedDate;
  }

  const stringValue = String(value);
  const dateOnlyMatch = stringValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(stringValue);

  if (Number.isNaN(date.getTime())) return null;

  date.setHours(0, 0, 0, 0);
  return date;
}

export function relativeDayDiff(value: unknown) {
  const date = parseJobDateValue(value);
  if (!date) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.round((date.getTime() - today.getTime()) / 86400000);
}

export function formatRelativeDate(value: unknown) {
  const dayDiff = relativeDayDiff(value);
  if (dayDiff == null) return '';

  if (dayDiff === 0) return 'today';
  if (dayDiff === 1) return 'in 1 day';
  if (dayDiff > 1) return `in ${dayDiff} days`;
  if (dayDiff === -1) return 'yesterday';
  return `${Math.abs(dayDiff)} days ago`;
}

export function dueDateColor(value: unknown) {
  const dayDiff = relativeDayDiff(value);
  if (dayDiff == null) return 'grey';
  if (dayDiff <= -7) return 'purple-lighten-2';
  if (dayDiff < 0) return 'error';
  if (dayDiff > 14) return 'success';
  return 'warning';
}
