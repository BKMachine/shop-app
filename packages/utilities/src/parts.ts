interface MaterialUsageInput {
  materialCutType?: 'blanks' | 'bars';
  materialLength?: number | null;
  blanksPerPart?: number | null;
  barLength?: number | null;
  remnantLength?: number | null;
}

interface MaterialCostInput extends MaterialUsageInput {
  customerSuppliedMaterial?: boolean;
}

interface RoutingOperationInput {
  op?: number | null;
  operation?: string | null;
  department?: string | null;
  time?: number | null;
  noCycleTime?: boolean | null;
}

interface AdditionalCostInput {
  cost?: number | null;
}

interface RateInputPart extends MaterialCostInput {
  routing?: RoutingOperationInput[] | null;
  additionalCosts?: AdditionalCostInput[] | null;
  material?: unknown;
}

interface AssemblyPartInput extends MaterialCostInput {
  _id?: string;
  routing?: RoutingOperationInput[] | null;
  additionalCosts?: AdditionalCostInput[] | null;
  material?: unknown;
  subComponentIds?: unknown;
  price?: number | null;
  hasSubComponents?: boolean;
  derived?: {
    directParentCount?: number | null;
    hasIncompleteSubComponentCosts?: boolean | null;
  } | null;
}

function hasDirectParent(part: AssemblyPartInput | null | undefined): boolean {
  return Number(part?.derived?.directParentCount) > 0;
}

function getBlanksPerPart(part: MaterialUsageInput | null | undefined): number {
  return Math.max(1, Number(part?.blanksPerPart) || 1);
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

  if (material.kind === 'piece') {
    return (Number(material.costPerPiece) || 0) * getBlanksPerPart(part);
  }

  const fullBarLength = Number(material.length) || 0;
  const partsPerBar = calculatePartsPerBar(part, fullBarLength);
  if (!partsPerBar) return 0;

  const materialCost = (fullBarLength / 12) * (Number(material.costPerFoot) || 0);
  const blanksPerPart = part.materialCutType === 'bars' ? 1 : getBlanksPerPart(part);
  return (materialCost / partsPerBar) * blanksPerPart;
}

/** Department value for routing ops done outside the shop's named departments. */
export const ROUTING_OTHER_DEPARTMENT = 'other';

export const ROUTING_OP_INCREMENT = 10;

/** Op number for a routing row: OP10, OP20, OP30... by position. */
export function routingOpNumber(index: number): number {
  return (index + 1) * ROUTING_OP_INCREMENT;
}

export function formatRoutingOp(op: number | null | undefined): string {
  return `OP${Number(op) || 0}`;
}

/** Op numbers always follow row order in increments of 10. */
export function renumberRouting<TOperation extends RoutingOperationInput>(
  routing: TOperation[] | null | undefined,
): TOperation[] {
  return (routing || []).map((operation, index) => ({ ...operation, op: routingOpNumber(index) }));
}

/** Display name for a routing op's department: the department name, 'Other', or '' if unset. */
export function routingDepartmentLabel(
  department: string | null | undefined,
  departmentNameById: ReadonlyMap<string, string>,
): string {
  if (!department) return '';
  if (department === ROUTING_OTHER_DEPARTMENT) return 'Other';
  return departmentNameById.get(department) ?? '';
}

export function isTimedRoutingOperation(operation: RoutingOperationInput): boolean {
  return !operation.noCycleTime;
}

export function calculateTotalCycleMinutes<TOperation extends RoutingOperationInput>(
  routing: TOperation[] | null | undefined,
): number {
  return (routing || []).reduce(
    (total, operation) =>
      isTimedRoutingOperation(operation) ? total + (Number(operation.time) || 0) : total,
    0,
  );
}

/**
 * A routing row is complete with an operation name, a department (Other counts) and, unless
 * flagged as having no cycle time, a time above zero. Placeholder rows count as incomplete.
 */
export function isIncompleteRoutingOperation(operation: RoutingOperationInput): boolean {
  if (!operation.operation?.trim()) return true;
  if (!operation.department?.trim()) return true;
  return isTimedRoutingOperation(operation) && !(Number(operation.time) > 0);
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
  if (!part?._id) return calculateTotalCycleMinutes(part?.routing);
  if (visited.has(part._id)) return 0;

  const nextVisited = new Set(visited);
  nextVisited.add(part._id);

  const ownCycleMinutes = calculateTotalCycleMinutes(part.routing);
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

export function hasMissingRateInputs<TPart extends RateInputPart>(part: TPart): boolean {
  const routing = part.routing || [];
  // An op explicitly marked "no cycle time" is real routing info, just like a timed op.
  const hasRoutingTimeInfo = routing.some(
    (operation) => !isTimedRoutingOperation(operation) || Number(operation.time) > 0,
  );
  const hasIncompleteCycleTimeEntry = routing.some(isIncompleteRoutingOperation);
  const hasAdditionalCost = (part.additionalCosts || []).some((cost) => Number(cost.cost) > 0);
  const isMissingMaterial = !part.material && !part.customerSuppliedMaterial;

  return (
    (!hasRoutingTimeInfo && !hasAdditionalCost) || hasIncompleteCycleTimeEntry || isMissingMaterial
  );
}

export function hasIncompletePartCostData(part: AssemblyPartInput | null | undefined): boolean {
  if (!part) return false;

  if (!Number(part.price)) {
    return !hasDirectParent(part);
  }

  const hasSubComponents =
    part.hasSubComponents === true || normalizeSubComponentIds(part.subComponentIds).length > 0;

  if (hasSubComponents) {
    // An assembly's own routing (assemble, inspect...) still needs complete rows.
    return (
      Boolean(part.derived?.hasIncompleteSubComponentCosts) ||
      (part.routing || []).some(isIncompleteRoutingOperation)
    );
  }

  return hasMissingRateInputs(part);
}

export function hasIncompleteMachineDashboardPartData(
  part: AssemblyPartInput | null | undefined,
): boolean {
  if (!part) return false;
  if (hasIncompletePartCostData(part)) return true;
  if (!hasDirectParent(part)) return false;

  return hasMissingRateInputs(part);
}

export function hasIncompleteAssemblyLeafCosts<TPart extends AssemblyPartInput>(
  part: TPart,
  resolvePart: (id: string) => TPart | undefined,
  visited = new Set<string>(),
): boolean {
  if (!part?._id) return false;
  if (visited.has(part._id)) return false;

  const nextVisited = new Set(visited);
  nextVisited.add(part._id);

  const subComponents = normalizeSubComponentIds(part.subComponentIds);
  for (const entry of subComponents) {
    const subComponent = resolvePart(entry.partId);
    if (!subComponent) continue;

    const nestedSubComponents = normalizeSubComponentIds(subComponent.subComponentIds);
    if (nestedSubComponents.length) {
      if (hasIncompleteAssemblyLeafCosts(subComponent, resolvePart, nextVisited)) {
        return true;
      }
      continue;
    }

    if (hasMissingRateInputs(subComponent)) {
      return true;
    }
  }

  return false;
}
