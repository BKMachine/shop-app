import {
  calculateAssemblyCycleMinutes,
  calculateAssemblyMaterialCost,
  calculatePartShopRate,
  hasIncompleteAssemblyLeafCosts,
  renumberRouting,
  routingOpNumber,
} from '@repo/utilities/parts';
import { isValidObjectId, Types } from 'mongoose';
import { emit } from '../../../server/sockets.js';
import { getEntityId, normalizeIdArray, toPlainEntity } from '../../../utilities/entities.js';
import escapeRegExp from '../../../utilities/escapeRegExp.js';
import { clampLimit, clampOffset } from '../../../utilities/pagination.js';
import { getSortDirection } from '../../../utilities/sorting.js';
import Audit from '../audit/audit_service.js';
import DepartmentModel from '../department/department_model.js';
import MaterialModel from '../material/material_model.js';
import Part, { type PartDoc } from './part_model.js';

type PartMutation = Part | PartUpdate | PartDoc;

function normalizeBlanksPerPart(value: unknown): number {
  return Math.max(1, Number(value) || 1);
}

/**
 * An op's id as a string: the one it has, or a new one for a new op (or a duplicate, so two rows
 * never share an id).
 */
function routingOperationId(value: unknown, seen: Set<string>): string {
  const id = value == null ? '' : String(value);
  const usable = isValidObjectId(id) && /^[0-9a-f]{24}$/i.test(id) && !seen.has(id);
  const result = usable ? id : new Types.ObjectId().toString();
  seen.add(result);
  return result;
}

function normalizeRouting(routing: unknown): RoutingOperation[] {
  if (!Array.isArray(routing)) return [];

  const seenIds = new Set<string>();
  return renumberRouting(
    routing.map((entry: Partial<RoutingOperation>) => {
      const noCycleTime = Boolean(entry?.noCycleTime);
      return {
        _id: routingOperationId(entry?._id, seenIds),
        op: 0,
        operation: typeof entry?.operation === 'string' ? entry.operation.trim() : '',
        department:
          typeof entry?.department === 'string' && entry.department.trim()
            ? entry.department.trim()
            : null,
        time: noCycleTime ? 0 : Math.max(0, Number(entry?.time) || 0),
        noCycleTime,
      };
    }),
  );
}

function getCustomerName(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  if ('name' in value) {
    const name = (value as { name?: unknown }).name;
    return typeof name === 'string' ? name : '';
  }

  return '';
}

async function resolveMaterial(material: unknown): Promise<Material | null> {
  const materialId = getEntityId(material);
  if (!materialId) return null;

  if (material && typeof material === 'object' && 'costPerFoot' in material) {
    return material as Material;
  }

  const loadedMaterial = await MaterialModel.findById(materialId).lean();
  if (!loadedMaterial) return null;

  return {
    ...loadedMaterial,
    _id: loadedMaterial._id.toString(),
  } as unknown as Material;
}

async function buildDerivedPartCandidate(part: unknown): Promise<Part> {
  const plainPart = toPlainEntity(part) as Partial<Part>;

  return {
    ...(plainPart as Part),
    _id: typeof plainPart._id === 'string' ? plainPart._id : String(plainPart._id ?? ''),
    customer: (plainPart.customer as Customer) ?? ({} as Customer),
    material: (await resolveMaterial(plainPart.material)) ?? undefined,
    part: plainPart.part ?? '',
    description: plainPart.description ?? '',
    stock: Number(plainPart.stock) || 0,
    materialCutType: plainPart.materialCutType === 'bars' ? 'bars' : 'blanks',
    materialLength: Number(plainPart.materialLength) || 0,
    blanksPerPart: normalizeBlanksPerPart(plainPart.blanksPerPart),
    barLength: Number(plainPart.barLength) || 0,
    remnantLength: Number(plainPart.remnantLength) || 0,
    createdAt:
      plainPart.createdAt instanceof Date
        ? plainPart.createdAt
        : new Date(plainPart.createdAt ?? Date.now()),
    routing: normalizeRouting(plainPart.routing),
    additionalCosts: plainPart.additionalCosts ?? [],
    price: Number(plainPart.price) || 0,
    subComponentIds: normalizeSubComponentIds(plainPart.subComponentIds),
    imageIds: normalizeIdArray(plainPart.imageIds),
    documentIds: normalizeIdArray(plainPart.documentIds),
  };
}

async function buildPersistencePayload(
  part: unknown,
  directParentCount: number,
  preserveManagedMediaFields = false,
  existingPart?: PartDoc | null,
) {
  const plainPart = toPlainEntity(part) as Partial<Part>;
  const derivedCandidate = await buildDerivedPartCandidate(part);
  await calculateDerivedPartProperties(derivedCandidate);

  return {
    ...plainPart,
    customer: getEntityId(plainPart.customer),
    material: getEntityId(plainPart.material) ?? null,
    blanksPerPart: normalizeBlanksPerPart(plainPart.blanksPerPart),
    routing: normalizeRouting(plainPart.routing),
    createdAt:
      plainPart.createdAt instanceof Date
        ? plainPart.createdAt
        : plainPart.createdAt
          ? new Date(plainPart.createdAt)
          : (existingPart?.createdAt ?? new Date()),
    subComponentIds: derivedCandidate.subComponentIds,
    derived: {
      shopRate: Number(derivedCandidate.derived?.shopRate) || 0,
      directSubComponentCount: Number(derivedCandidate.derived?.directSubComponentCount) || 0,
      directParentCount,
      hasIncompleteSubComponentCosts: Boolean(
        derivedCandidate.derived?.hasIncompleteSubComponentCosts,
      ),
    },
    img: preserveManagedMediaFields ? existingPart?.img : plainPart.img,
    imageIds: preserveManagedMediaFields
      ? existingPart?.imageIds
      : normalizeIdArray(plainPart.imageIds),
    documentIds: preserveManagedMediaFields
      ? existingPart?.documentIds
      : normalizeIdArray(plainPart.documentIds),
  };
}

const validSortFields = new Set([
  'part',
  'description',
  'customer.name',
  'shopRate',
  'price',
  'needsReview',
  'location',
  'position',
  'stock',
]);

function normalizeSubComponentIds(subComponentIds: unknown): PartSubComponent[] {
  if (!Array.isArray(subComponentIds)) return [];

  const normalized = subComponentIds.map((entry) => {
    if (typeof entry === 'string') return { partId: entry, qty: 1 };

    if (entry && typeof entry === 'object' && 'partId' in entry) {
      return {
        partId: String(entry.partId),
        qty: Math.max(1, Number(entry.qty) || 1),
      };
    }

    return { partId: String(entry), qty: 1 };
  });

  return normalized.filter(
    (entry, index, array) =>
      Boolean(entry.partId) &&
      array.findIndex((candidate) => candidate.partId === entry.partId) === index,
  );
}

function getDirectParentCount(part: Pick<Part, 'derived'> | null | undefined): number {
  return Math.max(0, Number(part?.derived?.directParentCount) || 0);
}

function normalizeSortField(field?: string): string {
  if (!field || !validSortFields.has(field)) return 'description';
  if (field === 'shopRate') return 'derived.shopRate';
  return field;
}

async function buildAssemblyPartGraph(rootPart: Part): Promise<Map<string, Part>> {
  const plainRootPart = rootPart;
  const normalizedSubComponentIds = normalizeSubComponentIds(plainRootPart.subComponentIds);
  const rootId = plainRootPart._id;
  const graph = new Map<string, Part>();
  const hydratedRoot: Part = {
    ...plainRootPart,
    _id: rootId,
    subComponentIds: normalizedSubComponentIds,
  };

  graph.set(rootId, hydratedRoot);

  let frontierIds = normalizedSubComponentIds.map((entry) => entry.partId);
  while (frontierIds.length) {
    const nextIds = [...new Set(frontierIds.filter((partId) => !graph.has(partId)))];
    if (!nextIds.length) break;

    const loadedParts = await Part.find({ _id: { $in: nextIds } })
      .populate('material')
      .lean();
    for (const loadedPart of loadedParts) {
      const loadedPartId = loadedPart._id.toString();
      graph.set(loadedPartId, {
        ...(loadedPart as unknown as Part),
        _id: loadedPartId,
        customer: {} as Customer,
        material: (await resolveMaterial(loadedPart.material)) ?? undefined,
        subComponentIds: normalizeSubComponentIds(loadedPart.subComponentIds),
      });
    }

    frontierIds = loadedParts.flatMap((loadedPart) =>
      normalizeSubComponentIds(loadedPart.subComponentIds).map((entry) => entry.partId),
    );
  }

  return graph;
}

async function assemblyDescendantsIncludePart(
  startIds: string[],
  targetId: string,
): Promise<boolean> {
  const visited = new Set<string>();
  let frontierIds = [...new Set(startIds.filter(Boolean))];

  while (frontierIds.length) {
    const nextIds = frontierIds.filter((partId) => !visited.has(partId));
    if (!nextIds.length) return false;
    if (nextIds.includes(targetId)) return true;

    nextIds.forEach((partId) => {
      visited.add(partId);
    });

    const loadedParts = (await Part.find(
      { _id: { $in: nextIds } },
      { _id: 1, subComponentIds: 1 },
    ).lean()) as unknown as Array<Pick<Part, '_id' | 'subComponentIds'>>;

    frontierIds = loadedParts.flatMap((loadedPart) =>
      normalizeSubComponentIds(loadedPart.subComponentIds).map((entry) => entry.partId),
    );
  }

  return false;
}

export async function calculateDerivedPartProperties(part: Part): Promise<void> {
  const normalizedSubComponentIds = normalizeSubComponentIds(part.subComponentIds);
  part.subComponentIds = normalizedSubComponentIds;
  const partGraph = await buildAssemblyPartGraph(part);

  part.derived = {
    shopRate: deriveShopRateFromGraph(part, partGraph),
    directSubComponentCount: normalizedSubComponentIds.length,
    directParentCount: getDirectParentCount(part),
    hasIncompleteSubComponentCosts: hasIncompleteSubComponentCosts(part, partGraph),
  };
}

// Material cost and cycle time for a part including its sub-components.
function getAssemblyCosts(part: Part, partGraph: Map<string, Part>) {
  const rootPart = partGraph.get(part._id);
  if (!rootPart) return null;

  const materialCost = calculateAssemblyMaterialCost(
    rootPart,
    (partId) => partGraph.get(partId),
    (material) => {
      if (material && typeof material === 'object' && 'costPerFoot' in material) {
        return material as Material;
      }

      return null;
    },
  );
  const cycleMinutes = calculateAssemblyCycleMinutes(rootPart, (partId) => partGraph.get(partId));

  return { materialCost, cycleMinutes };
}

const deriveShopRateFromGraph = (part: Part, partGraph: Map<string, Part>): number => {
  const costs = getAssemblyCosts(part, partGraph);
  if (!costs) return 0;

  return calculatePartShopRate(part.price, costs.materialCost, costs.cycleMinutes);
};

function hasIncompleteSubComponentCosts(part: Part, partGraph: Map<string, Part>): boolean {
  const rootPart = partGraph.get(part._id);
  if (!rootPart) return false;

  return hasIncompleteAssemblyLeafCosts(rootPart, (partId: string) => partGraph.get(partId));
}

function getSortValue(part: PartDoc, field: string): string | number {
  if (field === 'customer.name') return getCustomerName(toPlainEntity(part).customer);
  if (field === 'derived.shopRate') return Number(part.derived?.shopRate) || 0;
  if (field === 'needsReview') return part.needsReview ? 1 : 0;
  const value = (part as unknown as Record<string, unknown>)[field];
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return value;
  return '';
}

function compareParts(left: PartDoc, right: PartDoc, field: string, direction: 1 | -1) {
  const leftValue = getSortValue(left, field);
  const rightValue = getSortValue(right, field);

  if (typeof leftValue === 'number' && typeof rightValue === 'number') {
    if (leftValue === rightValue) return 0;
    return leftValue > rightValue ? direction : -direction;
  }

  return (
    String(leftValue).localeCompare(String(rightValue), undefined, {
      numeric: true,
      sensitivity: 'base',
    }) * direction
  );
}

async function validateSubComponentIds(subComponentIds: PartSubComponent[], partId?: string) {
  if (!partId) return subComponentIds;
  if (subComponentIds.some((entry) => entry.partId === partId))
    throw new Error('A part cannot include itself as a sub-component.');

  const subComponentPartIds = subComponentIds.map((entry) => entry.partId);
  if (await assemblyDescendantsIncludePart(subComponentPartIds, partId)) {
    throw new Error('Sub-components cannot create recursive assembly relationships.');
  }

  return subComponentIds;
}

function buildPartQuery(filters: PartListFilters) {
  const query: Record<string, unknown> = {};
  const exprConditions: Record<string, unknown>[] = [];

  if (filters.customer?.trim()) query.customer = filters.customer.trim();
  if (filters.location?.trim()) query.location = filters.location.trim();
  if (filters.position?.trim()) query.position = filters.position.trim();

  if (filters.search?.trim()) {
    const regex = new RegExp(escapeRegExp(filters.search.trim()), 'i');
    query.$or = [{ description: regex }, { part: regex }];
  }

  if (!filters.includeSubcomponents) {
    query['derived.directParentCount'] = 0;
  }

  if (exprConditions.length === 1) {
    query.$expr = exprConditions[0];
  } else if (exprConditions.length > 1) {
    query.$expr = { $and: exprConditions };
  }

  return query;
}

function getSortField(filters: PartListFilters): string {
  return normalizeSortField(filters.sort);
}

function createListItem(part: PartDoc): PartListItem {
  const normalizedSubComponentIds = normalizeSubComponentIds(part.subComponentIds);
  const directSubComponentCount =
    Number(part.derived?.directSubComponentCount) || normalizedSubComponentIds.length;
  const directParentCount = getDirectParentCount(part);
  const serializedPart = (part as unknown as { toObject(): Part }).toObject();

  return {
    ...serializedPart,
    blanksPerPart: normalizeBlanksPerPart(serializedPart.blanksPerPart),
    subComponentIds: normalizedSubComponentIds,
    derived: {
      shopRate: Number(part.derived?.shopRate) || 0,
      directSubComponentCount,
      directParentCount,
      hasIncompleteSubComponentCosts: Boolean(part.derived?.hasIncompleteSubComponentCosts),
    },
    hasSubComponents: directSubComponentCount > 0,
    isSubComponent: directParentCount > 0,
  };
}

function createDetailItem(part: PartDoc): Part {
  const normalizedSubComponentIds = normalizeSubComponentIds(part.subComponentIds);
  const directSubComponentCount =
    Number(part.derived?.directSubComponentCount) || normalizedSubComponentIds.length;
  const directParentCount = getDirectParentCount(part);
  const serializedPart = (part as unknown as { toObject(): Part }).toObject();

  return {
    ...serializedPart,
    blanksPerPart: normalizeBlanksPerPart(serializedPart.blanksPerPart),
    subComponentIds: normalizedSubComponentIds,
    derived: {
      shopRate: Number(part.derived?.shopRate) || 0,
      directSubComponentCount,
      directParentCount,
      hasIncompleteSubComponentCosts: Boolean(part.derived?.hasIncompleteSubComponentCosts),
    },
  };
}

async function searchSummaries(search: string, limit = 20): Promise<PartSearchItem[]> {
  const trimmedSearch = search.trim();
  if (!trimmedSearch) return [];

  const items = await Part.find(
    buildPartQuery({
      search: trimmedSearch,
      includeSubcomponents: true,
    }),
    { _id: 1, part: 1, description: 1 },
  )
    .sort({ part: 1 })
    .limit(clampLimit(limit, 20, 50))
    .lean();

  return items.map((item) => ({
    _id: item._id.toString(),
    part: item.part ?? '',
    description: item.description ?? '',
  }));
}

async function listSubComponents(id: string): Promise<PartRelationItem[]> {
  const part = await Part.findById(id, { subComponentIds: 1 }).lean();
  if (!part) return [];

  const entries = normalizeSubComponentIds(part.subComponentIds);
  if (!entries.length) return [];

  const children = await Part.find({
    _id: { $in: entries.map((entry) => entry.partId) },
  })
    .populate('customer')
    .populate('material');
  const childById = new Map(children.map((child) => [child._id.toString(), child]));

  return entries
    .map((entry) => {
      const child = childById.get(entry.partId);
      if (!child) return null;

      return {
        part: createDetailItem(child),
        qty: Math.max(1, Number(entry.qty) || 1),
      };
    })
    .filter((item): item is PartRelationItem => Boolean(item));
}

async function listParentAssemblies(id: string): Promise<PartRelationItem[]> {
  const parents = await Part.find({ 'subComponentIds.partId': id })
    .populate('customer')
    .populate('material');

  return parents
    .map((parent) => {
      const entry = normalizeSubComponentIds(parent.subComponentIds).find(
        (candidate) => candidate.partId === id,
      );
      if (!entry) return null;

      return {
        part: createDetailItem(parent),
        qty: Math.max(1, Number(entry.qty) || 1),
      };
    })
    .filter((item): item is PartRelationItem => Boolean(item))
    .sort((left, right) => left.part.part.localeCompare(right.part.part));
}

async function listRelations(id: string): Promise<PartRelationsResponse> {
  const [subComponents, parents] = await Promise.all([
    listSubComponents(id),
    listParentAssemblies(id),
  ]);

  return {
    subComponents,
    parents,
  };
}

async function updateDirectParentCounts(
  addedChildIds: string[],
  removedChildIds: string[],
): Promise<void> {
  const operations: Promise<unknown>[] = [];

  if (addedChildIds.length) {
    operations.push(
      Part.updateMany(
        { _id: { $in: addedChildIds } },
        { $inc: { 'derived.directParentCount': 1 } },
      ),
    );
  }

  if (removedChildIds.length) {
    operations.push(
      Part.updateMany(
        { _id: { $in: removedChildIds } },
        { $inc: { 'derived.directParentCount': -1 } },
      ),
    );
  }

  if (operations.length) await Promise.all(operations);
}

async function buildDerivedPersistenceUpdate(part: unknown, directParentCount?: number) {
  const derivedCandidate = await buildDerivedPartCandidate(part);
  if (typeof directParentCount === 'number') {
    derivedCandidate.derived = {
      shopRate: Number(derivedCandidate.derived?.shopRate) || 0,
      directSubComponentCount: Number(derivedCandidate.derived?.directSubComponentCount) || 0,
      directParentCount,
      hasIncompleteSubComponentCosts: Boolean(
        derivedCandidate.derived?.hasIncompleteSubComponentCosts,
      ),
    };
  }
  await calculateDerivedPartProperties(derivedCandidate);

  return {
    subComponentIds: derivedCandidate.subComponentIds,
    derived: {
      shopRate: Number(derivedCandidate.derived?.shopRate) || 0,
      directSubComponentCount: Number(derivedCandidate.derived?.directSubComponentCount) || 0,
      directParentCount:
        typeof directParentCount === 'number'
          ? directParentCount
          : getDirectParentCount(derivedCandidate),
      hasIncompleteSubComponentCosts: Boolean(
        derivedCandidate.derived?.hasIncompleteSubComponentCosts,
      ),
    },
  };
}

async function refreshStoredPartDerivedProperties(part: PartDoc): Promise<void> {
  await Part.findByIdAndUpdate(part._id, await buildDerivedPersistenceUpdate(part));
}

async function refreshParentDerivedProperties(
  partId: string,
  visited = new Set<string>(),
): Promise<void> {
  if (visited.has(partId)) return;
  visited.add(partId);

  const parents = await Part.find({ 'subComponentIds.partId': partId });
  for (const parent of parents) {
    await refreshStoredPartDerivedProperties(parent);
    await refreshParentDerivedProperties(parent._id.toString(), visited);
  }
}

async function refreshAllStoredDerivedProperties(): Promise<number> {
  const parts = await Part.find();
  const directParentCountByPartId = new Map<string, number>();

  for (const part of parts) {
    for (const subComponent of part.subComponentIds || []) {
      const childId = String(subComponent.partId);
      directParentCountByPartId.set(childId, (directParentCountByPartId.get(childId) || 0) + 1);
    }
  }

  for (const part of parts) {
    const directParentCount = directParentCountByPartId.get(part._id.toString()) || 0;
    await Part.findByIdAndUpdate(
      part._id,
      await buildDerivedPersistenceUpdate(part, directParentCount),
    );
  }

  return parts.length;
}

type LegacyCycleTime = { operation?: unknown; time?: unknown };

/**
 * One-time bulk conversion of legacy `cycleTimes` into `routing` (OP10, OP20, ...). Only parts
 * that have never had a routing are touched, so it is safe to run on every start. An operation
 * whose name exactly matches a department name gets that department; the rest stay unassigned
 * and show as missing data until someone picks one. `cycleTimes` is left in place.
 */
async function migratePartRoutingFromCycleTimes(): Promise<number> {
  const legacyParts = await Part.collection
    .find({ routing: { $exists: false } }, { projection: { _id: 1, cycleTimes: 1 } })
    .toArray();
  if (!legacyParts.length) return 0;

  const departments = await DepartmentModel.find({}, { name: 1 }).lean();
  const departmentIdByName = new Map(
    departments.map((department) => [
      department.name.trim().toLowerCase(),
      department._id.toString(),
    ]),
  );

  await Part.collection.bulkWrite(
    legacyParts.map((legacyPart) => {
      const cycleTimes: LegacyCycleTime[] = Array.isArray(legacyPart.cycleTimes)
        ? legacyPart.cycleTimes
        : [];
      const routing = cycleTimes.map((cycle, index) => {
        const operation = typeof cycle?.operation === 'string' ? cycle.operation.trim() : '';
        return {
          _id: new Types.ObjectId(),
          op: routingOpNumber(index),
          operation,
          department: departmentIdByName.get(operation.toLowerCase()) ?? null,
          time: Math.max(0, Number(cycle?.time) || 0),
          noCycleTime: false,
        };
      });

      return { updateOne: { filter: { _id: legacyPart._id }, update: { $set: { routing } } } };
    }),
  );

  // Unassigned departments change the missing-data flags assemblies store for their children.
  await refreshAllStoredDerivedProperties();
  return legacyParts.length;
}

/**
 * Gives every routing op without an `_id` one, for routing saved before ops had ids. Ops that
 * already have one keep it, so it is safe to run on every start. Returns how many parts changed.
 */
async function ensureRoutingOperationIds(): Promise<number> {
  const parts = await Part.collection
    .find(
      { routing: { $elemMatch: { _id: { $exists: false } } } },
      { projection: { _id: 1, routing: 1 } },
    )
    .toArray();
  if (!parts.length) return 0;

  await Part.collection.bulkWrite(
    parts.map((part) => {
      const routing = (Array.isArray(part.routing) ? part.routing : []).map(
        (operation: Record<string, unknown>) =>
          operation._id ? operation : { _id: new Types.ObjectId(), ...operation },
      );
      // Matching on the old routing too, so a save that landed meanwhile isn't overwritten.
      return {
        updateOne: {
          filter: { _id: part._id, routing: part.routing },
          update: { $set: { routing } },
        },
      };
    }),
  );
  return parts.length;
}

function calculateTotalValue(parts: Array<Pick<PartFields, 'price' | 'stock'>>): number {
  return parts.reduce(
    (sum, part) => sum + (Number(part.price) || 0) * (Number(part.stock) || 0),
    0,
  );
}

async function list(filters: PartListFilters = {}): Promise<PartListResult> {
  const limit = clampLimit(filters.limit, 10, 100);
  const offset = clampOffset(filters.offset);
  const query = buildPartQuery(filters);
  const sortField = getSortField(filters);
  const direction = getSortDirection(filters.order);

  if (sortField === 'customer.name') {
    const items = (await Part.find(query).populate('customer')) as PartDoc[];
    const sortedItems = [...items].sort((left, right) =>
      compareParts(left, right, sortField, direction),
    );
    const pagedItems = sortedItems.slice(offset, offset + limit);
    const totalValue = calculateTotalValue(sortedItems);

    return {
      items: pagedItems.map(createListItem),
      total: sortedItems.length,
      totalValue,
      limit,
      offset,
      hasMore: offset + pagedItems.length < sortedItems.length,
    };
  }

  const [items, total, allMatchingParts]: [
    items: PartDoc[],
    total: number,
    allMatchingParts: Array<Pick<PartFields, 'price' | 'stock'>>,
  ] = await Promise.all([
    Part.find(query)
      .sort({ [sortField]: direction })
      .skip(offset)
      .limit(limit)
      .populate('customer'),
    Part.countDocuments(query),
    Part.find(query, { price: 1, stock: 1 }).lean(),
  ]);

  return {
    items: items.map(createListItem),
    total,
    totalValue: calculateTotalValue(allMatchingParts),
    limit,
    offset,
    hasMore: offset + items.length < total,
  };
}

async function findById(id: string): Promise<Part | null> {
  const part = await Part.findById(id).populate('customer').populate('material');
  return part ? createDetailItem(part) : null;
}

// Per-part material cost, cycle minutes and shop rate counting sub-components, the figures the
// stored shop rate is derived from.
async function getCostSummary(id: string) {
  const part = await Part.findById(id);
  if (!part) return null;

  const candidate = await buildDerivedPartCandidate(part);
  const partGraph = await buildAssemblyPartGraph(candidate);
  const costs = getAssemblyCosts(candidate, partGraph) ?? { materialCost: 0, cycleMinutes: 0 };

  return {
    ...costs,
    shopRate: calculatePartShopRate(candidate.price, costs.materialCost, costs.cycleMinutes),
    hasIncompleteSubComponentCosts: hasIncompleteSubComponentCosts(candidate, partGraph),
  };
}

async function create(data: PartCreate, deviceId: string): Promise<Part> {
  const normalizedSubComponentIds = normalizeSubComponentIds(data.subComponentIds);

  const part = new Part(
    await buildPersistencePayload(
      {
        ...data,
        subComponentIds: normalizedSubComponentIds,
      },
      0,
    ),
  );
  await part.save();
  await updateDirectParentCounts(
    normalizedSubComponentIds.map((entry) => entry.partId),
    [],
  );

  const createdPart = await findById(part._id.toString());
  if (!createdPart) throw new Error(`Unable to load created part document id: ${part._id}`);

  emit('part', createdPart);
  await Audit.addPartAudit(null, createdPart, deviceId);
  return createdPart;
}

async function update(
  newPart: PartMutation,
  deviceId: string,
  options: UpdatePartOptions = {},
): Promise<Part | null> {
  const id = getEntityId(newPart._id);
  if (!id) throw new Error('Missing part document id.');
  const oldPart = await Part.findById(id);
  if (!oldPart) throw new Error(`Missing part document id: ${id}`);

  const normalizedSubComponentIds = normalizeSubComponentIds(newPart.subComponentIds);
  await validateSubComponentIds(normalizedSubComponentIds, id);

  const nextSubComponentIds = normalizedSubComponentIds.map((entry) => entry.partId);
  const previousSubComponentIds = normalizeSubComponentIds(oldPart.subComponentIds).map(
    (entry) => entry.partId,
  );
  const addedChildIds = nextSubComponentIds.filter(
    (partId) => !previousSubComponentIds.includes(partId),
  );
  const removedChildIds = previousSubComponentIds.filter(
    (partId) => !nextSubComponentIds.includes(partId),
  );

  const updatePayload = await buildPersistencePayload(
    {
      ...newPart,
      subComponentIds: normalizedSubComponentIds,
    },
    getDirectParentCount(oldPart),
    options.preserveManagedMediaFields,
    oldPart,
  );
  const updatedPart = await Part.findByIdAndUpdate(id, updatePayload, { returnDocument: 'after' });
  if (!updatedPart) throw new Error(`Unable to update part document id: ${id}`);
  await updateDirectParentCounts(addedChildIds, removedChildIds);
  await refreshParentDerivedProperties(id);

  const refreshedPart = await findById(id);
  if (!refreshedPart) throw new Error(`Unable to load updated part document id: ${id}`);
  emit('part', refreshedPart);
  await Audit.addPartAudit(oldPart, refreshedPart, deviceId);
  return refreshedPart;
}

async function stock(
  id: string,
  amount: number,
  deviceId: string,
): Promise<{ status: number; part: PartDoc | null }> {
  const oldPart = await Part.findById(id);
  if (!oldPart) return { status: 404, part: null };
  if (oldPart.stock + amount < 0) return { status: 400, part: null };

  const updatedPayload = oldPart.toObject();
  updatedPayload.stock += amount;

  const updatedPart = await Part.findByIdAndUpdate(id, updatedPayload, { returnDocument: 'after' })
    .populate('customer')
    .populate('material');
  if (!updatedPart) throw new Error(`Unable to update part document id: ${id}`);
  emit('part', updatedPart);
  await Audit.addPartAudit(oldPart, updatedPart, deviceId);
  return { status: 200, part: updatedPart };
}

function getPartLocations(): Promise<string[]> {
  return Part.distinct('location', { location: { $ne: null } });
}

function getPartPositions(location: string): Promise<string[]> {
  return Part.distinct('position', { location, position: { $ne: null } });
}

export default {
  list,
  searchSummaries,
  findById,
  getCostSummary,
  listSubComponents,
  listParentAssemblies,
  listRelations,
  create,
  update,
  stock,
  getPartLocations,
  getPartPositions,
  refreshAllStoredDerivedProperties,
  migratePartRoutingFromCycleTimes,
  ensureRoutingOperationIds,
};

export {
  ensureRoutingOperationIds,
  migratePartRoutingFromCycleTimes,
  refreshAllStoredDerivedProperties,
};
