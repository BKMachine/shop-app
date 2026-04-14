import type { LocationQueryValue } from 'vue-router';

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

export function calculatePartsPerBar(
  part: Pick<Part, 'materialCutType' | 'materialLength' | 'barLength' | 'remnantLength'>,
  fullBarLength: number,
): number {
  const cutType = part.materialCutType || 'blanks';
  const materialLength = Number(part.materialLength) || 0;
  const barLength = Number(part.barLength) || 0;
  const remnantLength = Number(part.remnantLength) || 0;

  if (!fullBarLength || !materialLength) return 0;

  if (cutType !== 'bars') {
    return Math.floor(fullBarLength / materialLength);
  }

  if (!barLength || barLength <= remnantLength) {
    return 0;
  }

  const subBars = Math.floor(fullBarLength / barLength);
  const remainderLength = fullBarLength % barLength;
  const usablePerSubBar = barLength - remnantLength;
  const partsPerSubBar = Math.floor(usablePerSubBar / materialLength);
  const usableRemainder = Math.max(remainderLength - remnantLength, 0);
  const remainderParts = Math.floor(usableRemainder / materialLength);

  return subBars * partsPerSubBar + remainderParts;
}

export function calculatePartMaterialCost(
  part: Pick<
    Part,
    | 'materialCutType'
    | 'materialLength'
    | 'barLength'
    | 'remnantLength'
    | 'customerSuppliedMaterial'
  >,
  material: Pick<Material, 'length' | 'costPerFoot'> | null | undefined,
): number {
  if (part.customerSuppliedMaterial) return 0;
  if (!material) return 0;

  const fullBarLength = Number(material.length) || 0;
  const partsPerBar = calculatePartsPerBar(part, fullBarLength);
  if (!partsPerBar) return 0;

  const materialCost = (fullBarLength / 12) * (Number(material.costPerFoot) || 0);
  return materialCost / partsPerBar;
}

export function calculateTotalCycleMinutes(cycleTimes: CycleTimes[] | null | undefined): number {
  return (cycleTimes || []).reduce((total, cycle) => total + (Number(cycle.time) || 0), 0);
}

export function calculateAssemblyCycleMinutes(
  part: Part,
  resolvePart: (id: string) => Part | undefined,
  visited = new Set<string>(),
): number {
  if (!part?._id) {
    return calculateTotalCycleMinutes(part?.cycleTimes);
  }

  if (visited.has(part._id)) {
    return 0;
  }

  const nextVisited = new Set(visited);
  nextVisited.add(part._id);

  const subComponents = (part.subComponentIds || []).map((entry) => {
    if (typeof entry === 'string') {
      return { partId: entry, qty: 1 };
    }

    return {
      partId: String(entry.partId),
      qty: Math.max(1, Number(entry.qty) || 1),
    };
  });
  if (!subComponents.length) {
    return calculateTotalCycleMinutes(part.cycleTimes);
  }

  return subComponents.reduce((total, entry) => {
    const subComponent = resolvePart(entry.partId);
    if (!subComponent) return total;
    return (
      total + calculateAssemblyCycleMinutes(subComponent, resolvePart, nextVisited) * entry.qty
    );
  }, 0);
}

export function calculateAssemblyMaterialCost(
  part: Part,
  resolvePart: (id: string) => Part | undefined,
  resolveMaterial: (material: Part['material']) => Material | null | undefined,
  visited = new Set<string>(),
): number {
  if (!part?._id) {
    return calculatePartMaterialCost(part, resolveMaterial(part?.material));
  }

  if (visited.has(part._id)) {
    return 0;
  }

  const nextVisited = new Set(visited);
  nextVisited.add(part._id);

  const subComponents = (part.subComponentIds || []).map((entry) => {
    if (typeof entry === 'string') {
      return { partId: entry, qty: 1 };
    }

    return {
      partId: String(entry.partId),
      qty: Math.max(1, Number(entry.qty) || 1),
    };
  });
  if (!subComponents.length) {
    return calculatePartMaterialCost(part, resolveMaterial(part.material));
  }

  return subComponents.reduce((total, entry) => {
    const subComponent = resolvePart(entry.partId);
    if (!subComponent) return total;
    return (
      total +
      calculateAssemblyMaterialCost(subComponent, resolvePart, resolveMaterial, nextVisited) *
        entry.qty
    );
  }, 0);
}

export function calculateRatePerHour(
  price: number | null | undefined,
  partMaterialCost: number,
  totalCycleMinutes: number,
): number {
  if (!totalCycleMinutes) return 0;

  const amountMinusMaterial = (Number(price) || 0) - partMaterialCost;
  return amountMinusMaterial / (totalCycleMinutes / 60);
}

export function buildMaterialDescription(material: Material): string {
  if (!material.type || !material.materialType) return '';

  const type = material.wallThickness ? 'Tubing' : 'Bar';
  let description = '';

  if (material.type === 'Flat') {
    const materialInfo = material.wallThickness
      ? `${material.height}" x ${material.width}" x ${material.wallThickness}"`
      : `${material.height}" x ${material.width}"`;
    description = `${material.materialType} Flat ${type} - ${materialInfo}`;
  } else if (material.type === 'Round') {
    const diameterInfo = material.wallThickness
      ? `${material.diameter}" ⌀ x ${material.wallThickness}"`
      : `${material.diameter}" ⌀`;
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
