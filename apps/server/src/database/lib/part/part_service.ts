import {
  calculateAssemblyCycleMinutes,
  calculateAssemblyMaterialCost,
  calculatePartShopRate,
} from '@repo/utilities/parts';
import { emit } from '../../../server/sockets.js';
import escapeRegExp from '../../../utilities/escapeRegExp.js';
import Audit from '../audit/audit_service.js';
import MaterialModel from '../material/material_model.js';
import Part, { type PartDoc } from './part_model.js';

type PartMutation = Part | PartUpdate | PartDoc;

function toPlainPart(part: unknown): Record<string, unknown> {
  if (part && typeof part === 'object' && 'toObject' in part) {
    const maybeDoc = part as { toObject?: () => unknown };
    if (typeof maybeDoc.toObject === 'function') {
      return maybeDoc.toObject() as Record<string, unknown>;
    }
  }

  return part as unknown as Record<string, unknown>;
}

function getCustomerName(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  if ('name' in value) {
    const name = (value as { name?: unknown }).name;
    return typeof name === 'string' ? name : '';
  }

  return '';
}

function getEntityId(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && '_id' in value) {
    return String((value as { _id: unknown })._id);
  }
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    return String(value);
  }

  return undefined;
}

function normalizeIdArray(values: unknown): string[] | undefined {
  if (!Array.isArray(values)) return undefined;

  return values
    .map((value) => getEntityId(value))
    .filter((value): value is string => Boolean(value));
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
  const plainPart = toPlainPart(part) as Partial<Part>;

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
    barLength: Number(plainPart.barLength) || 0,
    remnantLength: Number(plainPart.remnantLength) || 0,
    createdAt:
      plainPart.createdAt instanceof Date
        ? plainPart.createdAt
        : new Date(plainPart.createdAt ?? Date.now()),
    cycleTimes: plainPart.cycleTimes ?? [],
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
  const plainPart = toPlainPart(part) as Partial<Part>;
  const derivedCandidate = await buildDerivedPartCandidate(part);
  await calculateDerivedPartProperties(derivedCandidate);

  return {
    ...plainPart,
    customer: getEntityId(plainPart.customer),
    material: getEntityId(plainPart.material) ?? null,
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
  part.derived = {
    shopRate: await deriveShopRate(part),
    directSubComponentCount: normalizedSubComponentIds.length,
    directParentCount: getDirectParentCount(part),
  };
}

const deriveShopRate = async (part: Part): Promise<number> => {
  const rootId = part._id;
  const partGraph = await buildAssemblyPartGraph(part);
  const rootPart = partGraph.get(rootId);
  if (!rootPart) return 0;

  const partMaterialCost = calculateAssemblyMaterialCost(
    rootPart,
    (partId) => partGraph.get(partId),
    (material) => {
      if (material && typeof material === 'object' && 'costPerFoot' in material) {
        return material as Material;
      }

      return null;
    },
  );
  const totalCycleMinutes = calculateAssemblyCycleMinutes(rootPart, (partId) =>
    partGraph.get(partId),
  );

  return calculatePartShopRate(rootPart.price, partMaterialCost, totalCycleMinutes);
};

function getSortValue(part: PartDoc, field: string): string | number {
  if (field === 'customer.name') return getCustomerName(toPlainPart(part).customer);
  if (field === 'derived.shopRate') return Number(part.derived?.shopRate) || 0;
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

function getSortDirection(filters: PartListFilters): 1 | -1 {
  return filters.order === 'desc' ? -1 : 1;
}

function createListItem(part: PartDoc): PartListItem {
  const normalizedSubComponentIds = normalizeSubComponentIds(part.subComponentIds);
  const directSubComponentCount =
    Number(part.derived?.directSubComponentCount) || normalizedSubComponentIds.length;
  const directParentCount = getDirectParentCount(part);
  const serializedPart = (part as unknown as { toObject(): Part }).toObject();

  return {
    ...serializedPart,
    subComponentIds: normalizedSubComponentIds,
    derived: {
      shopRate: Number(part.derived?.shopRate) || 0,
      directSubComponentCount,
      directParentCount,
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
    subComponentIds: normalizedSubComponentIds,
    derived: {
      shopRate: Number(part.derived?.shopRate) || 0,
      directSubComponentCount,
      directParentCount,
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
    .limit(Math.min(Math.max(Number(limit) || 20, 1), 50))
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

async function list(filters: PartListFilters = {}): Promise<PartListResult> {
  const limit = Math.min(Math.max(Number(filters.limit) || 10, 1), 100);
  const offset = Math.max(Number(filters.offset) || 0, 0);
  const query = buildPartQuery(filters);
  const sortField = getSortField(filters);
  const direction = getSortDirection(filters);

  if (sortField === 'customer.name') {
    const items = (await Part.find(query).populate('customer')) as PartDoc[];
    const sortedItems = [...items].sort((left, right) =>
      compareParts(left, right, sortField, direction),
    );
    const pagedItems = sortedItems.slice(offset, offset + limit);

    return {
      items: pagedItems.map(createListItem),
      total: sortedItems.length,
      limit,
      offset,
      hasMore: offset + pagedItems.length < sortedItems.length,
    };
  }

  const [items, total]: [items: PartDoc[], total: number] = await Promise.all([
    Part.find(query)
      .sort({ [sortField]: direction })
      .skip(offset)
      .limit(limit)
      .populate('customer'),
    Part.countDocuments(query),
  ]);

  return {
    items: items.map(createListItem),
    total,
    limit,
    offset,
    hasMore: offset + items.length < total,
  };
}

async function findById(id: string): Promise<PartDoc | null> {
  return Part.findById(id).populate('customer').populate('material');
}

async function create(data: PartCreate, deviceId: string): Promise<PartDoc> {
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
): Promise<PartDoc | null> {
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
  listSubComponents,
  listParentAssemblies,
  listRelations,
  create,
  update,
  stock,
  getPartLocations,
  getPartPositions,
};
