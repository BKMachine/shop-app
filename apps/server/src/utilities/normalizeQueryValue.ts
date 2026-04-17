export function normalizeQueryValue(value: unknown): string | undefined {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : undefined;
  return typeof value === 'string' ? value : undefined;
}

export function normalizeBooleanQueryValue(value: unknown): boolean | undefined {
  const normalized = normalizeQueryValue(value);
  if (normalized === undefined) return undefined;
  return normalized === 'true';
}
