import { emit } from '../../../server/sockets.js';
import escapeRegExp from '../../../utilities/escapeRegExp.js';
import Audit from '../audit/audit_service.js';
import Tool, { type ToolDoc, type ToolPopulatedDoc } from './tool_model.js';

const validSortFields = new Set([
  'description',
  'vendor.name',
  'item',
  'coating',
  'location',
  'position',
  'stock',
  'toolType',
  'flutes',
]);

function buildToolQuery(filters: ToolListFilters) {
  const query: Record<string, unknown> = {};
  const exprConditions: Record<string, unknown>[] = [];

  if (filters.category && filters.category !== 'all') query.category = filters.category;
  if (filters.location?.trim()) query.location = filters.location.trim();
  if (filters.position?.trim()) query.position = filters.position.trim();

  if (filters.search?.trim()) {
    const regex = new RegExp(escapeRegExp(filters.search.trim()), 'i');
    query.$or = [{ description: regex }, { item: regex }, { barcode: regex }, { coating: regex }];
  }

  if (filters.toolType?.trim()) query.toolType = filters.toolType.trim();

  if (filters.cuttingDia?.trim()) {
    const cuttingDia = Number.parseFloat(filters.cuttingDia.trim());
    if (Number.isFinite(cuttingDia) && cuttingDia > 0) {
      exprConditions.push({
        $regexMatch: {
          input: { $toString: '$cuttingDia' },
          regex: `^${escapeRegExp(cuttingDia.toString())}`,
        },
      });
    }
  }

  if (filters.minFluteLength?.trim()) {
    const minFluteLength = Number.parseFloat(filters.minFluteLength);
    if (Number.isFinite(minFluteLength)) query.fluteLength = { $gte: minFluteLength };
  }

  if (exprConditions.length === 1) {
    query.$expr = exprConditions[0];
  } else if (exprConditions.length > 1) {
    query.$expr = { $and: exprConditions };
  }

  return query;
}

function getSortField(filters: ToolListFilters): string {
  return filters.sort && validSortFields.has(filters.sort) ? filters.sort : 'description';
}

function getSortDirection(filters: ToolListFilters): 1 | -1 {
  return filters.order === 'desc' ? -1 : 1;
}

function getSortValue(tool: ToolPopulatedDoc, field: string): string | number {
  if (field === 'vendor.name') {
    return tool.vendor?.name ?? '';
  }

  const value = (tool as unknown as Record<string, unknown>)[field];
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return value;
  return '';
}

function compareTools(
  left: ToolPopulatedDoc,
  right: ToolPopulatedDoc,
  field: string,
  direction: 1 | -1,
): number {
  const leftValue = getSortValue(left, field);
  const rightValue = getSortValue(right, field);

  if (typeof leftValue === 'number' && typeof rightValue === 'number') {
    if (leftValue === rightValue) return 0;
    return leftValue > rightValue ? direction : -direction;
  }

  const result = String(leftValue).localeCompare(String(rightValue), undefined, {
    numeric: true,
    sensitivity: 'base',
  });

  return result * direction;
}

async function list(filters: ToolListFilters = {}): Promise<ToolListDocs> {
  // Limit is between 1 and 100, default 10.
  // Offset is 0 or more, default 0.
  const limit = Math.min(Math.max(Number(filters.limit) || 10, 1), 100);
  const offset = Math.max(Number(filters.offset) || 0, 0);
  const query = buildToolQuery(filters);
  const sortField = getSortField(filters);
  const direction = getSortDirection(filters);

  if (sortField === 'vendor.name') {
    const items = (await Tool.find(query)
      .populate<{ vendor?: Vendor | null }>('vendor')
      .populate<{ supplier?: Supplier | null }>('supplier')) as ToolPopulatedDoc[];
    const sortedItems = [...items].sort((left, right) =>
      compareTools(left, right, sortField, direction),
    );
    const pagedItems = sortedItems.slice(offset, offset + limit);

    return {
      items: pagedItems,
      total: sortedItems.length,
      limit,
      offset,
      hasMore: offset + pagedItems.length < sortedItems.length,
    };
  }

  const [items, total] = (await Promise.all([
    Tool.find(query)
      .sort({ [sortField]: direction })
      .skip(offset)
      .limit(limit)
      .populate<{ vendor?: Vendor | null }>('vendor')
      .populate<{ supplier?: Supplier | null }>('supplier'),
    Tool.countDocuments(query),
  ])) as [ToolPopulatedDoc[], number];

  return {
    items,
    total,
    limit,
    offset,
    hasMore: offset + items.length < total,
  };
}

async function findById(id: string): Promise<ToolPopulatedDoc | null> {
  return Tool.findById(id)
    .populate<{ vendor?: Vendor | null }>('vendor')
    .populate<{ supplier?: Supplier | null }>('supplier');
}

async function findByScanCode(scanCode: string): Promise<ToolPopulatedDoc | null> {
  return Tool.findOne({
    $or: [{ item: scanCode }, { barcode: scanCode }],
  })
    .populate<{ vendor?: Vendor | null }>('vendor')
    .populate<{ supplier?: Supplier | null }>('supplier');
}

async function getAutoReorders(): Promise<ToolPopulatedDoc[]> {
  return Tool.find({
    $expr: { $lte: ['$stock', '$reorderThreshold'] },
    autoReorder: true,
    vendor: { $ne: null },
    supplier: { $ne: null },
  })
    .populate<{ vendor?: Vendor | null }>('vendor')
    .populate<{ supplier?: Supplier | null }>('supplier');
}

async function create(data: ToolCreate, deviceId: string): Promise<ToolDoc> {
  const tool = new Tool(data);
  await tool.save();
  emit('tool', tool);
  await Audit.addToolAudit(null, tool, deviceId);
  return tool;
}

async function update(newTool: ToolUpdate, deviceId: string): Promise<ToolPopulatedDoc | null> {
  const id = newTool._id;
  const oldTool: ToolDoc | null = await Tool.findById(id);
  if (!oldTool) throw new Error(`Missing tool document id: ${id}`);
  const computedTool = computedToolChanges(oldTool, newTool);
  const updatedTool = await Tool.findByIdAndUpdate(id, computedTool, { returnDocument: 'after' })
    .populate<{ vendor?: Vendor | null }>('vendor')
    .populate<{ supplier?: Supplier | null }>('supplier');
  if (!updatedTool) throw new Error(`Unable to update tool document id: ${id}`);
  emit('tool', updatedTool);
  await Audit.addToolAudit(oldTool, updatedTool, deviceId);
  return updatedTool;
}

async function pick(
  scanCode: string,
  deviceId: string,
): Promise<{ status: number; tool: ToolPopulatedDoc | null }> {
  const oldTool = await findByScanCode(scanCode);
  if (!oldTool) return { status: 404, tool: null };
  if (oldTool.stock <= 0) return { status: 400, tool: oldTool };
  const id = oldTool._id;

  const newTool = oldTool.toObject();
  newTool.stock--;

  const computedTool = computedToolChanges(oldTool, newTool);
  const updatedTool = await Tool.findByIdAndUpdate(id, computedTool, { returnDocument: 'after' })
    .populate<{ vendor?: Vendor | null }>('vendor')
    .populate<{ supplier?: Supplier | null }>('supplier');
  if (!updatedTool) throw new Error(`Unable to update tool document id: ${id}`);
  emit('tool', updatedTool);
  await Audit.addToolAudit(oldTool, updatedTool, deviceId);
  return { status: 200, tool: updatedTool };
}

async function stock(
  id: string,
  amount: number,
  deviceId: string,
): Promise<{ status: number; tool: ToolPopulatedDoc | null }> {
  const oldTool = await Tool.findById(id);
  if (!oldTool) return { status: 404, tool: null };
  if (oldTool.stock + amount < 0) return { status: 400, tool: null };

  const newTool = oldTool.toObject();
  newTool.stock += amount;

  const computedTool = computedToolChanges(oldTool, newTool);
  const updatedTool = await Tool.findByIdAndUpdate(id, computedTool, { returnDocument: 'after' })
    .populate<{ vendor?: Vendor | null }>('vendor')
    .populate<{ supplier?: Supplier | null }>('supplier');
  if (!updatedTool) throw new Error(`Unable to update tool document id: ${id}`);
  emit('tool', updatedTool);
  await Audit.addToolAudit(oldTool, updatedTool, deviceId);
  return { status: 200, tool: updatedTool };
}

function computedToolChanges<
  T extends {
    onOrder: boolean;
    orderedOn?: string;
    stock: number;
  },
>(oldTool: Pick<ToolFields, 'onOrder' | 'stock'>, newTool: T): T {
  // Set the orderedOn date if onOrder is newly set to true
  if (newTool.onOrder && !oldTool.onOrder) newTool.orderedOn = new Date().toISOString();
  // Assume if the current stock has increased that the order has been fulfilled
  if (newTool.stock > oldTool.stock) newTool.onOrder = false;
  return newTool;
}

function getToolLocations(): Promise<string[]> {
  return Tool.distinct('location', { location: { $ne: null } });
}

function getToolPositions(location: string): Promise<string[]> {
  return Tool.distinct('position', { location, position: { $ne: null } });
}

export default {
  list,
  findById,
  findByScanCode,
  create,
  update,
  getAutoReorders,
  pick,
  stock,
  getToolLocations,
  getToolPositions,
};
