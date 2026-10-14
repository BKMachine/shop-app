// Shared types and drawing helpers for the machining calculator rows and diagrams.

export type Units = 'in' | 'mm';

export const MM_PER_INCH = 25.4;
export const METERS_PER_FOOT = 0.3048;

// Every field gets one accent color, used by its input, its formula term and its part of the diagram.
export const CALC_ACCENTS: Record<string, string> = {
  dia: 'var(--calc-dia)',
  rpm: 'var(--calc-rpm)',
  sfm: 'var(--calc-sfm)',
  ipr: 'var(--calc-ipr)',
  ipm: 'var(--calc-ipm)',
  ipt: 'var(--calc-ipt)',
  flutes: 'var(--calc-flutes)',
  woc: 'var(--calc-woc)',
  chip: 'var(--calc-chip)',
};

export interface CalcFieldDef {
  key: string;
  label: string;
  unit: string;
  icon: string;
  step: number;
  // Shown as a small tile in a grid above the full-width fields.
  stacked?: boolean;
}

export type FormulaToken = string | { key: string; text: string };

export interface CalcRowModel {
  id: string;
  title: string;
  subtitle: string;
  fields: CalcFieldDef[];
  formula: FormulaToken[];
  text: Record<string, string>;
  solvedKeys: readonly string[];
  setInput: (key: string, value: string) => void;
  clear: () => void;
}

export interface Highlight {
  row: string;
  key: string;
}

export function rad(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function arrowHead(x: number, y: number, dx: number, dy: number, size = 8) {
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const bx = x - ux * size;
  const by = y - uy * size;
  const w = size * 0.5;
  return `${x},${y} ${bx - uy * w},${by + ux * w} ${bx + uy * w},${by - ux * w}`;
}

// Log scale from a reading in inches to 0..1, so small and large values both draw sensibly.
export function logScale(inches: number | null, min: number, max: number) {
  if (!inches) return 0.5;
  const t = (Math.log10(inches) - Math.log10(min)) / (Math.log10(max) - Math.log10(min));
  return Math.min(1, Math.max(0, t));
}

export function toInches(value: number | null, units: Units) {
  if (value === null) return null;
  return units === 'in' ? value : value / MM_PER_INCH;
}

// Display spin period for a given RPM: faster spindles spin faster, within watchable limits.
export function spinSeconds(rpm: number | null | undefined) {
  return rpm ? Math.max(0.35, 4 - Math.log10(rpm)) : 4;
}

// Radial chip thinning: with radial engagement under half the cutter diameter, the chip is thinner
// than the feed per tooth. Returns hex / fz (1 at ae >= D/2, smaller as engagement drops).
export function chipThinningRatio(dia: number | null, woc: number | null) {
  if (!dia || !woc || woc >= dia / 2) return 1;
  const engagement = woc / dia;
  return Math.sqrt(1 - (1 - 2 * engagement) ** 2);
}
