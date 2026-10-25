import {
  isPieceMaterial,
  normalizeDimensions,
  normalizePieceName,
} from '@repo/utilities/materials';
import { emit } from '../../../server/sockets.js';
import escapeRegExp from '../../../utilities/escapeRegExp.js';
import Audit from '../audit/audit_service.js';
import Supplier from '../supplier/supplier_model.js';
import Material, { type MaterialDoc } from './material_model.js';

type MaterialSearch = Partial<
  Pick<
    MaterialFields,
    | 'kind'
    | 'type'
    | 'form'
    | 'isMetric'
    | 'materialType'
    | 'height'
    | 'width'
    | 'diameter'
    | 'wallThickness'
    | 'length'
  >
> & {
  search?: string;
  supplier?: string;
  tolerance: number;
  limit: number;
};

type MaterialSizes = Partial<
  Record<'height' | 'width' | 'diameter' | 'wallThickness' | 'length', number | null>
>;

type MaterialMatch = {
  material: MaterialDoc;
  difference: number;
  exact: boolean;
};

type MaterialCostField = 'costPerFoot' | 'costPerPiece';

type MaterialCostChange = {
  material: MaterialDoc;
  previousCost: number | null;
  recorded: boolean;
  currentCostUpdated: boolean;
};

type MaterialCostHistory = {
  material: MaterialDoc;
  field: MaterialCostField;
  costAtStart: number | null;
  changes: {
    at: Date;
    cost: number | null;
    previousCost: number | null;
    recordedBy: string | null;
  }[];
};

function getCostField(material: MaterialDoc): MaterialCostField {
  return isPieceMaterial(material) ? 'costPerPiece' : 'costPerFoot';
}

// Sizes closer than this are the same number up to floating point, e.g. millimeters converted to
// inches by different code.
const EXACT_SIZE_DIFFERENCE = 1e-6;

// How far a stored size is from a requested one. An omitted (undefined) size isn't compared; a null
// one only matches a material that also lacks it, so solid bar never matches tube.
function sizeGap(requested: number | null | undefined, stored: number | null | undefined): number {
  if (requested === undefined) return 0;
  if (requested === null || stored == null) return requested === (stored ?? null) ? 0 : Infinity;
  return Math.abs(requested - stored);
}

// The largest gap, in inches, between `sizes` and the material's. Flat sizes compare in either
// orientation, since pieces and older documents aren't always saved with width >= height, and a
// single side can be either one. Bar length only identifies pieces.
function sizeDifference(material: MaterialDoc, sizes: MaterialSizes): number {
  const { height, width } = sizes;
  let flatGap = 0;
  if (height !== undefined && width !== undefined) {
    flatGap = Math.min(
      Math.max(sizeGap(height, material.height), sizeGap(width, material.width)),
      Math.max(sizeGap(width, material.height), sizeGap(height, material.width)),
    );
  } else if (height !== undefined || width !== undefined) {
    const side = height ?? width;
    flatGap = Math.min(sizeGap(side, material.height), sizeGap(side, material.width));
  }

  return Math.max(
    flatGap,
    sizeGap(sizes.diameter, material.diameter),
    sizeGap(sizes.wallThickness, material.wallThickness),
    isPieceMaterial(material) ? sizeGap(sizes.length, material.length) : 0,
  );
}

// Materials within `tolerance` inches of `sizes`, closest first.
function matchSizes(
  materials: MaterialDoc[],
  sizes: MaterialSizes,
  tolerance: number,
): MaterialMatch[] {
  return materials
    .map((material) => {
      const difference = sizeDifference(material, sizes);
      return { material, difference, exact: difference < EXACT_SIZE_DIFFERENCE };
    })
    .filter((match) => match.difference <= tolerance + EXACT_SIZE_DIFFERENCE)
    .sort((a, b) => a.difference - b.difference);
}

async function list(): Promise<MaterialDoc[]> {
  return await Material.find({}).populate('supplier');
}

async function create(data: MaterialCreate, deviceId: string): Promise<MaterialDoc> {
  const material = new Material(normalizeDimensions(data));
  await material.save();
  await Audit.addMaterialAudit(null, material, deviceId);
  emit('material', material);
  return material;
}

async function update(data: MaterialUpdate, deviceId: string): Promise<MaterialDoc> {
  const id = data._id;
  const oldMaterial = await Material.findById(id);
  if (!oldMaterial) throw new Error(`Missing material document id: ${id}`);
  const updatedMaterial = await Material.findByIdAndUpdate(id, normalizeDimensions(data), {
    returnDocument: 'after',
  }).populate('supplier');
  if (!updatedMaterial) throw new Error(`Unable to update material document id: ${id}`);
  await Audit.addMaterialAudit(oldMaterial, updatedMaterial, deviceId);
  emit('material', updatedMaterial);
  return updatedMaterial;
}

async function findByParsedMaterial(data: Partial<MaterialCreate>): Promise<MaterialDoc | null> {
  if (!data.materialType || !data.type) return null;

  const normalizedQuery = {
    materialType: data.materialType,
    type: data.type,
    height: data.height ?? null,
    width: data.width ?? null,
    diameter: data.diameter ?? null,
    wallThickness: data.wallThickness ?? null,
    length: data.length ?? null,
  };

  const query = {
    ...normalizeDimensions(normalizedQuery),
    isMetric: data.isMetric ? true : { $ne: true },
  };

  return await Material.findOne(query).populate('supplier');
}

// Sizes are compared in code rather than in the query, so they can match within a tolerance; the
// query narrows by everything else.
async function search(
  filters: MaterialSearch,
): Promise<{ matches: MaterialMatch[]; truncated: boolean }> {
  const query: Record<string, unknown> = {};

  // Documents saved before `kind` existed are stock.
  if (filters.kind) query.kind = filters.kind === 'piece' ? 'piece' : { $ne: 'piece' };
  if (filters.type) query.type = filters.type;
  if (filters.form) query.form = filters.form;
  if (filters.isMetric !== undefined) query.isMetric = filters.isMetric ? true : { $ne: true };
  if (filters.materialType?.trim()) {
    query.materialType = new RegExp(`^${escapeRegExp(filters.materialType.trim())}$`, 'i');
  }

  if (filters.supplier?.trim()) {
    const regex = new RegExp(escapeRegExp(filters.supplier.trim()), 'i');
    const suppliers = await Supplier.find({ name: regex }, '_id');
    query.supplier = { $in: suppliers.map((supplier) => supplier._id) };
  }

  if (filters.search?.trim()) {
    const regex = new RegExp(escapeRegExp(filters.search.trim()), 'i');
    query.$or = [{ description: regex }, { name: regex }];
  }

  const materials = await Material.find(query)
    .sort({ materialType: 1, description: 1 })
    .populate('supplier');
  const matches = matchSizes(materials, filters, filters.tolerance);

  return {
    matches: matches.slice(0, filters.limit),
    truncated: matches.length > filters.limit,
  };
}

// Materials that `data` would duplicate, within `tolerance` inches, closest first. Stock is told
// apart by its cross-section, since cost per foot covers any bar length, and not by supplier; a
// piece by its form, name and size.
async function findMatches(data: MaterialCreate, tolerance: number): Promise<MaterialMatch[]> {
  if (isPieceMaterial(data)) {
    const name = normalizePieceName(data.name);
    const pieces = await Material.find({
      kind: 'piece',
      materialType: data.materialType,
      form: data.form,
      name: name ? new RegExp(`^${escapeRegExp(name)}$`, 'i') : null,
    }).populate('supplier');
    const sizes = { height: data.height, width: data.width, length: data.length };
    return matchSizes(pieces, sizes, tolerance);
  }

  const stock = await Material.find({
    kind: { $ne: 'piece' },
    materialType: data.materialType,
    type: data.type,
    isMetric: data.isMetric ? true : { $ne: true },
  }).populate('supplier');
  const crossSection =
    data.type === 'Flat' ? { height: data.height, width: data.width } : { diameter: data.diameter };
  return matchSizes(stock, { ...crossSection, wallThickness: data.wallThickness }, tolerance);
}

// Sorted by grade, shape and then size, so materials of nearly the same size sit together.
async function listPage(
  offset: number,
  limit: number,
): Promise<{ materials: MaterialDoc[]; total: number }> {
  const [materials, total] = await Promise.all([
    Material.find({})
      .sort({
        materialType: 1,
        kind: 1,
        type: 1,
        form: 1,
        diameter: 1,
        height: 1,
        width: 1,
        wallThickness: 1,
        _id: 1,
      })
      .skip(offset)
      .limit(limit)
      .populate('supplier'),
    Material.countDocuments({}),
  ]);
  return { materials, total };
}

// Records a cost that took effect at `effectiveAt` as a material audit with that timestamp, which
// is what the cost history is built from. A change newer than the recorded history becomes the
// current cost; an older one is only inserted into the history, since later audits already
// record what came after it. A material with no recorded history gives no way to tell whether a
// past price predates its current cost, so the caller has to decide via `updateCurrent`.
async function recordCost(
  id: string,
  field: MaterialCostField,
  cost: number,
  effectiveAt: Date,
  updateCurrent: boolean | undefined,
  deviceId: string,
): Promise<MaterialCostChange> {
  const material = await Material.findById(id).populate('supplier');
  if (!material) throw new Error(`Missing material document id: ${id}`);

  const expectedField = getCostField(material);
  if (field !== expectedField) {
    throw new Error(`Material ${id} is a ${material.kind} material; set ${expectedField} instead.`);
  }

  const [priorAudit, laterAudit] = await Promise.all([
    Audit.findMaterialAuditAt(id, effectiveAt),
    Audit.findMaterialAuditAfter(id, effectiveAt),
  ]);

  if (laterAudit && updateCurrent) {
    throw new Error(
      `A later change to material ${id} is recorded at ${new Date(laterAudit.timestamp).toISOString()}, so a cost effective ${effectiveAt.toISOString()} cannot become its current cost.`,
    );
  }

  if (!priorAudit && !laterAudit && updateCurrent === undefined && material[field] !== cost) {
    throw new Error(
      `Material ${id} has no recorded cost history, so it is unknown whether a cost effective ${effectiveAt.toISOString()} is newer than its current ${field} of ${material[field]}. Pass updateCurrent: true to also make it the current cost, or false to only record it as history.`,
    );
  }

  if (updateCurrent ?? (!laterAudit && priorAudit !== null)) {
    const previousCost = material[field];
    if (previousCost === cost) {
      return { material, previousCost, recorded: false, currentCostUpdated: false };
    }

    const updatedMaterial = await Material.findByIdAndUpdate(
      id,
      { [field]: cost },
      { returnDocument: 'after' },
    ).populate('supplier');
    if (!updatedMaterial) throw new Error(`Unable to update material document id: ${id}`);
    await Audit.addMaterialAudit(material, updatedMaterial, deviceId, effectiveAt);
    emit('material', updatedMaterial);
    return { material: updatedMaterial, previousCost, recorded: true, currentCostUpdated: true };
  }

  // Without an earlier audit the cost before `effectiveAt` is unknown.
  const before = priorAudit?.new ?? {
    ...material.toObject({ depopulate: true }),
    costPerFoot: null,
    costPerPiece: null,
  };
  const previousCost: number | null = before[field] ?? null;
  if (previousCost === cost) {
    return { material, previousCost, recorded: false, currentCostUpdated: false };
  }

  await Audit.addAudit('material', before, { ...before, [field]: cost }, deviceId, effectiveAt);
  return { material, previousCost, recorded: true, currentCostUpdated: false };
}

// Cost changes from `from` through `to`, oldest first. Each is compared with the audit before it
// rather than its own old value, which goes stale when a backfilled change is inserted ahead of
// it; only the first, with nothing before it, falls back to its old value. Audits that leave the
// cost alone are dropped.
async function getCostHistory(id: string, from?: Date, to?: Date): Promise<MaterialCostHistory> {
  const material = await Material.findById(id).populate('supplier');
  if (!material) throw new Error(`Missing material document id: ${id}`);

  const field = getCostField(material);
  const audits = await Audit.getMaterialCostAudits(id, from, to);

  let costAtStart: number | null = null;
  let lastCost: number | null | undefined;
  const changes: MaterialCostHistory['changes'] = [];

  for (const audit of audits) {
    const at = new Date(audit.timestamp);
    const cost: number | null = audit.new?.[field] ?? null;

    if (from && at < from) {
      costAtStart = cost;
      lastCost = cost;
      continue;
    }
    const previousCost: number | null =
      lastCost === undefined ? (audit.old?.[field] ?? null) : lastCost;
    lastCost = cost;
    if (cost === previousCost) continue;

    changes.push({ at, cost, previousCost, recordedBy: audit.device?.displayName ?? null });
  }

  return { material, field, costAtStart, changes };
}

async function updateCostPerFoot(
  id: string,
  costPerFoot: number,
  deviceId: string,
): Promise<MaterialDoc> {
  const oldMaterial = await Material.findById(id);
  if (!oldMaterial) throw new Error(`Missing material document id: ${id}`);
  const updatedMaterial = await Material.findByIdAndUpdate(
    id,
    { costPerFoot },
    { returnDocument: 'after' },
  ).populate('supplier');
  if (!updatedMaterial) throw new Error(`Unable to update material document id: ${id}`);
  await Audit.addMaterialAudit(oldMaterial, updatedMaterial, deviceId);
  emit('material', updatedMaterial);
  return updatedMaterial;
}

export default {
  list,
  create,
  update,
  findByParsedMaterial,
  search,
  findMatches,
  listPage,
  recordCost,
  getCostHistory,
  updateCostPerFoot,
};
