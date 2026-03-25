export const RATE_TONES = ['rateLow', 'rateWarn', 'rateOk', 'rateGood', 'rateTurbo'] as const;

export type RateTone = (typeof RATE_TONES)[number];

export const RATE_TARGET_RANGE = {
  min: 50,
  max: 200,
  step: 5,
} as const;
export const RATE_THRESHOLDS = [100, 125, 150, 175] as const;

export function buildRateThresholdGradient(
  minRate: number,
  maxRate: number,
  thresholds: readonly number[] = RATE_THRESHOLDS,
  tones: readonly RateTone[] = RATE_TONES,
): string {
  const range = maxRate - minRate;
  if (range <= 0 || tones.length === 0) {
    return `linear-gradient(90deg, rgb(var(--v-theme-${RATE_TONES[0]})) 0%, rgb(var(--v-theme-${RATE_TONES[0]})) 100%)`;
  }

  const normalizedThresholds = Array.from(
    new Set(
      thresholds
        .filter((value) => Number.isFinite(value))
        .map((value) => Math.min(maxRate, Math.max(minRate, value)))
        .sort((a, b) => a - b),
    ),
  );

  const bounds = [minRate, ...normalizedThresholds, maxRate];
  const toPercent = (value: number) => ((value - minRate) / range) * 100;

  const stops: string[] = [];

  for (let index = 0; index < bounds.length - 1; index += 1) {
    const start = bounds[index] ?? minRate;
    const end = bounds[index + 1] ?? maxRate;
    const tone = tones[Math.min(index, tones.length - 1)] ?? RATE_TONES[0];
    const color = `rgb(var(--v-theme-${tone}))`;

    stops.push(`${color} ${toPercent(start)}%`, `${color} ${toPercent(end)}%`);
  }

  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

export function getToneForRate(
  rate: number,
  thresholds: readonly number[] = RATE_THRESHOLDS,
  tones: readonly RateTone[] = RATE_TONES,
): RateTone {
  for (let index = 0; index < thresholds.length; index += 1) {
    const threshold = thresholds[index];
    if (threshold != null && rate < threshold) {
      return tones[Math.min(index, tones.length - 1)] ?? RATE_TONES[0];
    }
  }

  return tones[Math.min(thresholds.length, tones.length - 1)] ?? RATE_TONES[0];
}
