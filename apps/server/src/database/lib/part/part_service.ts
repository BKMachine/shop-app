import {
  calculateAssemblyCycleMinutes,
  calculateAssemblyMaterialCost,
  calculatePartShopRate,
} from '@repo/utilities/parts';
import { emit } from '../../../server/sockets.js';
import escapeRegExp from '../../../utilities/escapeRegExp.js';
import Audit from '../audit/audit_service.js';
import Material from '../material/material_model.js';
import Part from './part_model.js';

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

    return {
      partId: String(entry),
      qty: 1,
    };
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

function getPartId(value: unknown): string {
  return String(value);
}

function toPlainPart(part: Part): Part {
  if (
    part &&
    typeof part === 'object' &&
    'toObject' in part &&
    typeof part.toObject === 'function'
  ) {
    return (part as unknown as { toObject(): Part }).toObject();
  }

  return part;
}

function getMaterialId(material: unknown): string | null {
  if (!material) return null;
  if (typeof material === 'string') return material;
  if (typeof material === 'object' && '_id' in material && material._id) {
    return String(material._id);
  }

  return null;
}

async function hydrateMaterial(material: Part['material']): Promise<Material | undefined> {
  if (!material) return undefined;
  if (typeof material === 'object' && 'costPerFoot' in material) return material as Material;

  const materialId = getMaterialId(material);
  if (!materialId) return undefined;

  return ((await Material.findById(materialId).lean()) as Material | null) || undefined;
}

async function buildAssemblyPartGraph(rootPart: Part): Promise<Map<string, Part>> {
  const plainRootPart = toPlainPart(rootPart);
  const normalizedSubComponentIds = normalizeSubComponentIds(plainRootPart.subComponentIds);
  const rootId = getPartId(plainRootPart._id);
  const graph = new Map<string, Part>();
  const hydratedRoot: Part = {
    ...plainRootPart,
    _id: rootId,
    material: await hydrateMaterial(plainRootPart.material),
    subComponentIds: normalizedSubComponentIds,
  };

  graph.set(rootId, hydratedRoot);

  let frontierIds = normalizedSubComponentIds.map((entry) => entry.partId);
  while (frontierIds.length) {
    const nextIds = [...new Set(frontierIds.filter((partId) => !graph.has(partId)))];
    if (!nextIds.length) break;

    const loadedParts = (await Part.find({ _id: { $in: nextIds } })
      .populate('material')
      .lean()) as Part[];
    for (const loadedPart of loadedParts) {
      const loadedPartId = getPartId(loadedPart._id);
      graph.set(loadedPartId, {
        ...loadedPart,
        _id: loadedPartId,
        subComponentIds: normalizeSubComponentIds(loadedPart.subComponentIds),
      });
    }

    frontierIds = loadedParts.flatMap((loadedPart) =>
      normalizeSubComponentIds(loadedPart.subComponentIds).map((entry) => entry.partId),
    );
  }

  return graph;
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
  const rootId = getPartId(part._id);
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
  if (field === 'customer.name') return part.customer.name;
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

  const parts = await Part.find({}, { _id: 1, subComponentIds: 1 }).lean();
  const dependencyMap = new Map(
    parts.map((part) => [
      String(part._id),
      normalizeSubComponentIds(part.subComponentIds).map((entry) => entry.partId),
    ]),
  );

  const dependsOn = (
    candidateId: string,
    targetId: string,
    visited = new Set<string>(),
  ): boolean => {
    if (visited.has(candidateId)) return false;

    const nextVisited = new Set(visited);
    nextVisited.add(candidateId);

    return (dependencyMap.get(candidateId) || []).some((subComponentId) => {
      if (subComponentId === targetId) return true;
      return dependsOn(subComponentId, targetId, nextVisited);
    });
  };

  for (const subComponent of subComponentIds) {
    if (dependsOn(subComponent.partId, partId))
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

async function findByScanCode(scanCode: string): Promise<PartDoc | null> {
  return Part.findById(scanCode).populate('customer');
}

async function findById(id: string): Promise<PartDoc | null> {
  return Part.findById(id).populate('customer').populate('material');
}

async function create(data: PartDoc, deviceId: string): Promise<PartDoc> {
  const normalizedSubComponentIds = normalizeSubComponentIds(data.subComponentIds);
  await validateSubComponentIds(normalizedSubComponentIds, data._id.toString());

  const part = new Part({
    ...data,
    subComponentIds: normalizedSubComponentIds,
  });

  await calculateDerivedPartProperties(part);
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
  newPart: PartDoc,
  deviceId: string,
  options: UpdatePartOptions = {},
): Promise<PartDoc | null> {
  const id = newPart._id;
  const oldPart: PartDoc | null = await Part.findById(id);
  if (!oldPart) throw new Error(`Missing part document id: ${id}`);

  const normalizedSubComponentIds = normalizeSubComponentIds(newPart.subComponentIds);
  await validateSubComponentIds(normalizedSubComponentIds, id.toString());

  const previousSubComponentIds = normalizeSubComponentIds(oldPart.subComponentIds).map(
    (entry) => entry.partId,
  );
  const nextSubComponentIds = normalizedSubComponentIds.map((entry) => entry.partId);
  const addedChildIds = nextSubComponentIds.filter(
    (partId) => !previousSubComponentIds.includes(partId),
  );
  const removedChildIds = previousSubComponentIds.filter(
    (partId) => !nextSubComponentIds.includes(partId),
  );

  const updatePayload = {
    ...newPart,
    subComponentIds: normalizedSubComponentIds,
    derived: {
      shopRate: Number(newPart.derived?.shopRate) || 0,
      directSubComponentCount: Number(newPart.derived?.directSubComponentCount) || 0,
      directParentCount: getDirectParentCount(oldPart),
    },
  };

  if (options.preserveManagedMediaFields) {
    updatePayload.img = oldPart.img;
    updatePayload.imageIds = oldPart.imageIds;
    updatePayload.documentIds = oldPart.documentIds;
  }

  await calculateDerivedPartProperties(updatePayload);
  const updatedPart = await Part.findByIdAndUpdate(id, updatePayload, { returnDocument: 'after' });
  if (!updatedPart) throw new Error(`Unable to update part document id: ${id}`);
  await updateDirectParentCounts(addedChildIds, removedChildIds);

  const refreshedPart = await findById(id.toString());
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

  const newPart: PartDoc = oldPart.toObject();
  newPart.stock += amount;

  const updatedPart = await Part.findByIdAndUpdate(id, newPart, { returnDocument: 'after' })
    .populate('customer')
    .populate('material');
  if (!updatedPart) throw new Error(`Unable to update part document id: ${id}`);
  emit('part', updatedPart);
  await Audit.addPartAudit(oldPart, updatedPart, deviceId);
  return { status: 200, part: updatedPart };
}

export default {
  list,
  findByScanCode,
  findById,
  create,
  update,
  stock,
};
