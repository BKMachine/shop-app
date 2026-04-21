import type { LocationQueryValue } from 'vue-router';

export {
  calculateAssemblyCycleMinutes,
  calculateAssemblyMaterialCost,
  calculatePartMaterialCost,
  calculatePartShopRate,
  calculatePartsPerBar,
  calculateTotalCycleMinutes,
} from '@repo/utilities/parts';

export function isNumber(evt: KeyboardEvent) {
  const keysAllowed: string[] = [
    '0',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '.',
    'Backspace',
    'ArrowUp',
    'ArrowDown',
  ];
  const keyPressed: string = evt.key;

  if (!keysAllowed.includes(keyPressed)) {
    evt.preventDefault();
  }
}

export function onlyAllowNumeric(e: KeyboardEvent) {
  if (
    [
      'Backspace',
      'Delete',
      'Tab',
      'Escape',
      'Enter',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
    ].includes(e.key)
  ) {
    return;
  }

  if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) {
    return;
  }

  if (/^[0-9.]$/.test(e.key)) {
    return;
  }

  e.preventDefault();
}

export function formatWeight(val: number | null | undefined): string {
  if (val == null || Number.isNaN(val)) return '';
  return parseFloat(val.toFixed(2)).toString();
}

export function formatDimension(val: number | null | undefined): string {
  if (val == null || Number.isNaN(val)) return '';
  return parseFloat(val.toFixed(4)).toString();
}

const MILLIMETERS_PER_INCH = 25.4;

export function formatCrossSectionDimension(
  val: number | null | undefined,
  isMetric = false,
): string {
  if (val == null || Number.isNaN(val)) return '';
  const displayValue = isMetric ? val * MILLIMETERS_PER_INCH : val;
  return formatDimension(displayValue);
}

export function formatCost(val: number | null | undefined): string {
  if (val == null || Number.isNaN(val)) return '';
  return val.toFixed(2);
}

export function hasLogoUrl(logo: string | undefined): boolean {
  return Boolean(logo?.trim());
}

export function parseCycle(val: string | number | null | undefined): number {
  if (typeof val === 'number') {
    return Number.isNaN(val) ? 0 : Math.max(0, val);
  }

  if (!val) {
    return 0;
  }

  const trimmed = val.trim();
  if (!trimmed) {
    return 0;
  }

  if (trimmed.includes(':')) {
    const [minutesRaw, secondsRaw] = trimmed.split(':');
    const minutes = Number(minutesRaw);
    const seconds = Number(secondsRaw);

    if (Number.isNaN(minutes) || Number.isNaN(seconds) || seconds < 0 || seconds >= 60) {
      return 0;
    }

    return Math.max(0, minutes) + seconds / 60;
  }

  const parsed = Number(trimmed);
  if (Number.isNaN(parsed)) {
    return 0;
  }

  return Math.max(0, parsed);
}

export function formatCycle(val: number | string | null | undefined): string {
  const minutesDecimal = parseCycle(val);
  const totalSeconds = Math.max(0, Math.round(minutesDecimal * 60));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function formatCycleLonghand(val: number | string | null | undefined): string {
  const minutesDecimal = parseCycle(val);
  const totalSeconds = Math.max(0, Math.round(minutesDecimal * 60));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

interface MaterialDescriptionInput {
  type: string;
  materialType: string;
  isMetric?: boolean;
  wallThickness: number | null;
  height: number | null;
  width: number | null;
  diameter: number | null;
}

function formatMaterialDimensionToken(value: number | null, isMetric: boolean): string {
  const formatted = formatCrossSectionDimension(value, isMetric);
  return formatted ? `${formatted}${isMetric ? 'mm' : '"'}` : '';
}

export function buildMaterialDescription<T extends MaterialDescriptionInput>(material: T): string {
  if (!material.type || !material.materialType) return '';

  const type = material.wallThickness ? 'Tubing' : 'Bar';
  const isMetric = material.isMetric ?? false;
  let description = '';

  if (material.type === 'Flat') {
    const materialInfo = material.wallThickness
      ? `${formatMaterialDimensionToken(material.height, isMetric)} x ${formatMaterialDimensionToken(material.width, isMetric)} x ${formatMaterialDimensionToken(material.wallThickness, isMetric)}`
      : `${formatMaterialDimensionToken(material.height, isMetric)} x ${formatMaterialDimensionToken(material.width, isMetric)}`;
    description = `${material.materialType} Flat ${type} - ${materialInfo}`;
  } else if (material.type === 'Round') {
    const diameterInfo = material.wallThickness
      ? `${formatMaterialDimensionToken(material.diameter, isMetric)} ⌀ x ${formatMaterialDimensionToken(material.wallThickness, isMetric)}`
      : `${formatMaterialDimensionToken(material.diameter, isMetric)} ⌀`;
    description = `${material.materialType} Round ${type} - ${diameterInfo}`;
  } else {
    description = `${material.materialType}`;
  }

  return description;
}

export function normalizeQueryValue(
  value: LocationQueryValue | LocationQueryValue[] | undefined,
): string | undefined {
  const firstValue = Array.isArray(value) ? value[0] : value;
  return firstValue ?? undefined;
}
