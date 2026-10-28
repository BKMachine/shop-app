import {
  isPieceMaterial,
  normalizeDimensions,
  normalizePieceName,
} from '@repo/utilities/materials';
import { Types } from 'mongoose';
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

type SupplierRef = { id: string; name: string | null };

type MaterialCostHistory = {
  material: MaterialDoc;
  field: MaterialCostField;
  costAtStart: number | null;
  supplierAtStart: SupplierRef | null;
  changes: {
    at: Date;
    cost: number | null;
    previousCost: number | null;
    supplier: SupplierRef | null;
    recordedBy: string | null;
  }[];
};

function getCostField(material: MaterialDoc): MaterialCostField {
  return isPieceMaterial(material) ? 'costPerPiece' : 'costPerFoot';
}

// A supplier's id as a string: audit snapshots hold the id, a loaded material the populated
// supplier.
function supplierIdOf(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'object' && '_id' in value) return String(value._id);
  return String(value);
}

// Matches stored text regardless of case or surrounding spaces, which older documents don't
// always agree on (a grade saved as "4130 ", a shape as "flat").
function looseText(value: string): RegExp {
  return new RegExp(`^\\s*${escapeRegExp(value.trim())}\\s*$`, 'i');
}

const normalizedText = (value: string | null | undefined) => value?.trim().toLowerCase() ?? '';

function compareSizes(a: number | null | undefined, b: number | null | undefined): number {
  const left = a ?? Number.NEGATIVE_INFINITY;
  const right = b ?? Number.NEGATIVE_INFINITY;
  return left === right ? 0 : left < right ? -1 : 1;
}

// Grade, kind, shape or form, then size. Compares loaded documents rather than sorting in the
// query: an older document missing `kind` gets its default when loaded, but in a query it sorts
// before every value and would land apart from the rest of its grade.
function compareForListing(a: MaterialDoc, b: MaterialDoc): number {
  return (
    normalizedText(a.materialType).localeCompare(normalizedText(b.materialType)) ||
    normalizedText(a.kind).localeCompare(normalizedText(b.kind)) ||
    normalizedText(a.type).localeCompare(normalizedText(b.type)) ||
    normalizedText(a.form).localeCompare(normalizedText(b.form)) ||
    compareSizes(a.diameter, b.diameter) ||
    compareSizes(a.height, b.height) ||
    compareSizes(a.width, b.width) ||
    compareSizes(a.wallThickness, b.wallThickness) ||
    a._id.toString().localeCompare(b._id.toString())
  );
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
  if (filters.type) query.type = looseText(filters.type);
  if (filters.form) query.form = filters.form;
  if (filters.isMetric !== undefined) query.isMetric = filters.isMetric ? true : { $ne: true };
  if (filters.materialType?.trim()) {
    query.materialType = looseText(filters.materialType);
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
      materialType: looseText(data.materialType),
      form: data.form,
      name: name ? new RegExp(`^${escapeRegExp(name)}$`, 'i') : null,
    }).populate('supplier');
    const sizes = { height: data.height, width: data.width, length: data.length };
    return matchSizes(pieces, sizes, tolerance);
  }

  const stock = await Material.find({
    kind: { $ne: 'piece' },
    materialType: looseText(data.materialType),
    type: data.type ? looseText(data.type) : null,
    isMetric: data.isMetric ? true : { $ne: true },
  }).populate('supplier');
  const crossSection =
    data.type === 'Flat' ? { height: data.height, width: data.width } : { diameter: data.diameter };
  return matchSizes(stock, { ...crossSection, wallThickness: data.wallThickness }, tolerance);
}

// Sorted so materials of nearly the same size sit together. The catalog is small enough to sort
// whole in code.
async function listPage(
  offset: number,
  limit: number,
): Promise<{ materials: MaterialDoc[]; total: number }> {
  const materials = await Material.find({}).populate('supplier');
  materials.sort(compareForListing);
  return { materials: materials.slice(offset, offset + limit), total: materials.length };
}

// Records a cost that took effect at `effectiveAt` as a material audit with that timestamp, which
// is what the cost history is built from. A change newer than the recorded history becomes the
// current cost; an older one is only inserted into the history, since later audits already
// record what came after it. When the current cost isn't in the recorded history there is no way
// to tell whether a past price predates it, so the caller has to decide via `updateCurrent`.
// `supplierId` is who the price came from: it goes into the recorded change and, when the price
// becomes the current cost, onto the material. A price is recorded again when only its supplier
// differs.
async function recordCost(
  id: string,
  field: MaterialCostField,
  cost: number,
  effectiveAt: Date,
  updateCurrent: boolean | undefined,
  deviceId: string,
  supplierId?: string,
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

  // The current cost is only known to predate `effectiveAt` when the latest recorded change ends
  // at it. Otherwise it was set outside the recorded history (before audits, or after a backfill
  // that left it alone) and could be newer than this cost.
  const currentCostRecorded =
    !laterAudit && priorAudit !== null && (priorAudit.new?.[field] ?? null) === material[field];
  if (
    !laterAudit &&
    !currentCostRecorded &&
    updateCurrent === undefined &&
    material[field] !== cost
  ) {
    throw new Error(
      `Material ${id}'s current ${field} of ${material[field]} is not in its recorded cost history, so it is unknown whether a cost effective ${effectiveAt.toISOString()} is newer. Pass updateCurrent: true to also make it the current cost, or false to only record it as history.`,
    );
  }

  const supplierChange = (supplier: unknown) =>
    supplierId !== undefined && supplierIdOf(supplier) !== supplierId;

  if (updateCurrent ?? currentCostRecorded) {
    const previousCost = material[field];
    if (previousCost === cost && !supplierChange(material.supplier)) {
      return { material, previousCost, recorded: false, currentCostUpdated: false };
    }

    const updatedMaterial = await Material.findByIdAndUpdate(
      id,
      { [field]: cost, ...(supplierId ? { supplier: supplierId } : {}) },
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
  if (previousCost === cost && !supplierChange(before.supplier)) {
    return { material, previousCost, recorded: false, currentCostUpdated: false };
  }

  const after = {
    ...before,
    [field]: cost,
    ...(supplierId ? { supplier: new Types.ObjectId(supplierId) } : {}),
  };
  await Audit.addAudit('material', before, after, deviceId, effectiveAt);
  return { material, previousCost, recorded: true, currentCostUpdated: false };
}

// Cost changes from `from` through `to`, oldest first. Each is compared with the audit before it
// rather than its own old value, which goes stale when a backfilled change is inserted ahead of
// it; only the first, with nothing before it, falls back to its old value. Audits that leave both
// the cost and the supplier alone are dropped.
async function getCostHistory(id: string, from?: Date, to?: Date): Promise<MaterialCostHistory> {
  const material = await Material.findById(id).populate('supplier');
  if (!material) throw new Error(`Missing material document id: ${id}`);

  const field = getCostField(material);
  const audits = await Audit.getMaterialCostAudits(id, from, to);
  const suppliers = await Supplier.find({}, 'name');
  const supplierRef = (supplierId: string | null): SupplierRef | null =>
    supplierId
      ? {
          id: supplierId,
          name: suppliers.find((supplier) => supplier._id.toString() === supplierId)?.name ?? null,
        }
      : null;

  let costAtStart: number | null = null;
  let supplierAtStart: SupplierRef | null = null;
  let lastCost: number | null | undefined;
  let lastSupplier: string | null | undefined;
  const changes: MaterialCostHistory['changes'] = [];

  for (const audit of audits) {
    const at = new Date(audit.timestamp);
    const cost: number | null = audit.new?.[field] ?? null;
    const supplier = supplierIdOf(audit.new?.supplier);

    if (from && at < from) {
      costAtStart = cost;
      supplierAtStart = supplierRef(supplier);
      lastCost = cost;
      lastSupplier = supplier;
      continue;
    }
    const previousCost: number | null =
      lastCost === undefined ? (audit.old?.[field] ?? null) : lastCost;
    const previousSupplier =
      lastSupplier === undefined ? supplierIdOf(audit.old?.supplier) : lastSupplier;
    lastCost = cost;
    lastSupplier = supplier;
    if (cost === previousCost && supplier === previousSupplier) continue;

    changes.push({
      at,
      cost,
      previousCost,
      supplier: supplierRef(supplier),
      recordedBy: audit.device?.displayName ?? null,
    });
  }

  return { material, field, costAtStart, supplierAtStart, changes };
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
