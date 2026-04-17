interface MaterialUsageInput {
  materialCutType?: 'blanks' | 'bars';
  materialLength?: number | null;
  barLength?: number | null;
  remnantLength?: number | null;
}

interface MaterialCostInput extends MaterialUsageInput {
  customerSuppliedMaterial?: boolean;
}

interface CycleTimeInput {
  time?: number | null;
}

interface AssemblyPartInput extends MaterialCostInput {
  _id?: string;
  cycleTimes?: CycleTimeInput[] | null;
  material?: unknown;
  subComponentIds?: unknown;
}

export function calculatePartsPerBar<TPart extends MaterialUsageInput>(
  part: TPart,
  fullBarLength: number,
): number {
  const cutType = part.materialCutType || 'blanks';
  const materialLength = Number(part.materialLength) || 0;
  const barLength = Number(part.barLength) || 0;
  const remnantLength = Number(part.remnantLength) || 0;

  if (!fullBarLength || !materialLength) return 0;
  if (cutType !== 'bars') return Math.floor(fullBarLength / materialLength);
  if (!barLength || barLength <= remnantLength) return 0;

  const subBars = Math.floor(fullBarLength / barLength);
  const remainderLength = fullBarLength % barLength;
  const usablePerSubBar = barLength - remnantLength;
  const partsPerSubBar = Math.floor(usablePerSubBar / materialLength);
  const usableRemainder = Math.max(remainderLength - remnantLength, 0);
  const remainderParts = Math.floor(usableRemainder / materialLength);

  return subBars * partsPerSubBar + remainderParts;
}

export function calculatePartMaterialCost<TPart extends MaterialCostInput>(
  part: TPart,
  material: Material | null | undefined,
): number {
  if (part.customerSuppliedMaterial) return 0;
  if (!material) return 0;

  const fullBarLength = Number(material.length) || 0;
  const partsPerBar = calculatePartsPerBar(part, fullBarLength);
  if (!partsPerBar) return 0;

  const materialCost = (fullBarLength / 12) * (Number(material.costPerFoot) || 0);
  return materialCost / partsPerBar;
}

export function calculateTotalCycleMinutes<TCycleTime extends CycleTimeInput>(
  cycleTimes: TCycleTime[] | null | undefined,
): number {
  return (cycleTimes || []).reduce((total, cycle) => total + (Number(cycle.time) || 0), 0);
}

function normalizeSubComponentIds(subComponentIds: unknown): PartSubComponent[] {
  if (!Array.isArray(subComponentIds)) {
    return [];
  }

  return subComponentIds.map((entry) => {
    if (typeof entry === 'string') {
      return { partId: entry, qty: 1 };
    }

    if (entry && typeof entry === 'object' && 'partId' in entry) {
      return {
        partId: String(entry.partId),
        qty: Math.max(1, Number(entry.qty) || 1),
      };
    }

    return {
      partId: String(entry),
      qty: 1,
    };
  });
}

export function calculateAssemblyCycleMinutes<TPart extends AssemblyPartInput>(
  part: TPart,
  resolvePart: (id: string) => TPart | undefined,
  visited = new Set<string>(),
): number {
  if (!part?._id) return calculateTotalCycleMinutes(part?.cycleTimes);
  if (visited.has(part._id)) return 0;

  const nextVisited = new Set(visited);
  nextVisited.add(part._id);

  const ownCycleMinutes = calculateTotalCycleMinutes(part.cycleTimes);
  const subComponents = normalizeSubComponentIds(part.subComponentIds);
  if (!subComponents.length) return ownCycleMinutes;

  return subComponents.reduce((total, entry) => {
    const subComponent = resolvePart(entry.partId);
    if (!subComponent) return total;
    return (
      total + calculateAssemblyCycleMinutes(subComponent, resolvePart, nextVisited) * entry.qty
    );
  }, ownCycleMinutes);
}

export function calculateAssemblyMaterialCost<TPart extends AssemblyPartInput>(
  part: TPart,
  resolvePart: (id: string) => TPart | undefined,
  resolveMaterial: (material: TPart['material']) => Material | null | undefined,
  visited = new Set<string>(),
): number {
  if (!part?._id) return calculatePartMaterialCost(part, resolveMaterial(part?.material));
  if (visited.has(part._id)) return 0;

  const nextVisited = new Set(visited);
  nextVisited.add(part._id);

  const ownMaterialCost = calculatePartMaterialCost(part, resolveMaterial(part.material));
  const subComponents = normalizeSubComponentIds(part.subComponentIds);
  if (!subComponents.length) return ownMaterialCost;

  return subComponents.reduce((total, entry) => {
    const subComponent = resolvePart(entry.partId);
    if (!subComponent) return total;
    return (
      total +
      calculateAssemblyMaterialCost(subComponent, resolvePart, resolveMaterial, nextVisited) *
        entry.qty
    );
  }, ownMaterialCost);
}

export function calculatePartShopRate(
  price: number | null | undefined,
  partMaterialCost: number,
  totalCycleMinutes: number,
): number {
  if (!totalCycleMinutes) return 0;
  const hasNoProductPrice = price == null || price === 0;
  if (hasNoProductPrice) return 0;

  const amountMinusMaterial = (Number(price) || 0) - partMaterialCost;
  return amountMinusMaterial / (totalCycleMinutes / 60);
}
