import { DEFAULT_BUSINESS_TIME_ZONE } from '@repo/utilities/time';
import { DateTime } from 'luxon';
import * as z from 'zod';
import Customers from '../../database/lib/customer/customer_service.js';

export const dateFormat = `an ISO 8601 date or date-time; a value without an offset is read in ${DEFAULT_BUSINESS_TIME_ZONE}`;

export const PageInput = {
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
};

export function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

export function pageResult<T>(
  key: string,
  page: { items: T[]; total: number; offset: number },
  toItem: (item: T) => unknown,
  extra: Record<string, unknown> = {},
) {
  const nextOffset = page.offset + page.items.length;
  return jsonResult({
    total: page.total,
    nextOffset: nextOffset < page.total ? nextOffset : null,
    ...extra,
    [key]: page.items.map(toItem),
  });
}

export function parseDate(
  name: string,
  value: string,
  zone: string = DEFAULT_BUSINESS_TIME_ZONE,
): DateTime {
  const date = DateTime.fromISO(value, { zone });
  if (!date.isValid) {
    throw new Error(`Invalid ${name} "${value}"; use an ISO 8601 date or date-time.`);
  }
  return date;
}

export function parseRange(
  from: string | undefined,
  to: string | undefined,
  [fromName, toName] = ['from', 'to'],
  zone: string = DEFAULT_BUSINESS_TIME_ZONE,
) {
  const fromDate = from ? parseDate(fromName, from, zone).toJSDate() : undefined;
  // A date without a time covers that whole day.
  const toDate = to
    ? (to.includes('T')
        ? parseDate(toName, to, zone)
        : parseDate(toName, to, zone).endOf('day')
      ).toJSDate()
    : undefined;
  if (fromDate && toDate && fromDate > toDate) {
    throw new Error(`${fromName} must be before ${toName}.`);
  }
  return { fromDate, toDate };
}

// An exact name, or a part of one that only one customer's name contains.
export async function findCustomerId(name: string): Promise<string> {
  const customers = await Customers.list();
  const search = name.trim().toLowerCase();
  const exact = customers.find((customer) => customer.name.toLowerCase() === search);
  if (exact) return exact._id.toString();

  const partial = customers.filter((customer) => customer.name.toLowerCase().includes(search));
  if (partial.length === 1 && partial[0]) return partial[0]._id.toString();
  if (partial.length) {
    throw new Error(
      `"${name}" matches several customers: ${partial.map((customer) => customer.name).join(', ')}.`,
    );
  }
  throw new Error(`No customer matches "${name}".`);
}
