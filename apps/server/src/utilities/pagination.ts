export function clampLimit(value: unknown, defaultValue: number, max: number): number {
  return Math.min(Math.max(Number(value) || defaultValue, 1), max);
}

export function clampOffset(value: unknown): number {
  return Math.max(Number(value) || 0, 0);
}
