import type { NextFunction, Request, Response } from 'express';

function trimStringValues<T>(value: T): T {
  if (typeof value === 'string') {
    return value.trim() as T;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => trimStringValues(entry)) as T;
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return value;
  }

  for (const [key, entry] of Object.entries(value)) {
    (value as Record<string, unknown>)[key] = trimStringValues(entry);
  }

  return value;
}

export default function trimRequestStrings(req: Request, _res: Response, next: NextFunction): void {
  req.body = trimStringValues(req.body);
  req.query = trimStringValues(req.query);
  req.params = trimStringValues(req.params);
  next();
}

export { trimStringValues };
