import { emit } from '../../../server/sockets';
import Audit from '../audit';
import Tool from './tool_model';

async function list(): Promise<ToolDoc[]> {
  return Tool.find({});
}

async function findById(id: string): Promise<ToolDoc | null> {
  return Tool.findById(id).populate('vendor').populate('supplier');
}

async function findByScanCode(scanCode: string): Promise<ToolDoc | null> {
  return Tool.findOne({
    $or: [{ item: scanCode }, { barcode: scanCode }],
  })
    .populate('vendor')
    .populate('supplier');
}

async function getAutoReorders(): Promise<ToolDoc[]> {
  return Tool.find({
    $expr: { $lte: ['$stock', '$reorderThreshold'] },
    autoReorder: true,
  })
    .populate('vendor')
    .populate('supplier');
}

async function add(data: ToolDoc): Promise<ToolDoc> {
  const tool = new Tool(data);
  await tool.save();
  await Audit.addToolAudit(null, tool);
  emit('tool', tool);
  return tool;
}

async function update(newTool: ToolDoc): Promise<ToolDoc | null> {
  const id = newTool._id;
  const oldTool: ToolDoc | null = await Tool.findById(id);
  if (!oldTool) throw new Error(`Missing tool document id: ${id}`);
  const computedTool = computedToolChanges(oldTool, newTool);
  const updatedTool = await Tool.findByIdAndUpdate(id, computedTool, { new: true });
  if (!updatedTool) throw new Error(`Unable to update tool document id: ${id}`);
  await Audit.addToolAudit(oldTool, updatedTool);
  emit('tool', updatedTool);
  return updatedTool;
}

async function pick(scanCode: string): Promise<{ status: number; tool: ToolDoc | null }> {
  // Find tool by matching passed scanCode to tool item or barcode property
  const oldTool = await Tool.findOne({
    $or: [{ item: scanCode }, { barcode: scanCode }],
  })
    .populate('vendor')
    .populate('supplier');
  if (!oldTool) return { status: 404, tool: null };
  if (oldTool.stock <= 0) return { status: 400, tool: oldTool };
  const id = oldTool._id;
  // Copy tool before any changes are made
  const newTool = { ...oldTool.toObject() };
  newTool.stock--;
  const computedTool = computedToolChanges(oldTool, newTool);
  const updatedTool = await Tool.findByIdAndUpdate(id, computedTool, { new: true })
    .populate('vendor')
    .populate('supplier');
  if (!updatedTool) throw new Error(`Unable to update tool document id: ${id}`);
  await Audit.addToolAudit(oldTool, updatedTool);
  emit('tool', updatedTool);
  return { status: 200, tool: updatedTool };
}

async function stock(
  id: string,
  amount: number,
): Promise<{ status: number; tool: ToolDoc | null }> {
  const oldTool = await Tool.findById(id).populate('vendor').populate('supplier');
  if (!oldTool) return { status: 404, tool: null };
  if (oldTool.stock + amount < 0) return { status: 400, tool: oldTool };
  // Copy tool before any changes are made
  const newTool: ToolDoc = { ...oldTool.toObject() };
  newTool.stock += amount;
  const computedTool = computedToolChanges(oldTool, newTool);
  const updatedTool = await Tool.findByIdAndUpdate(id, computedTool, { new: true })
    .populate('vendor')
    .populate('supplier');
  if (!updatedTool) throw new Error(`Unable to update tool document id: ${id}`);
  await Audit.addToolAudit(oldTool, updatedTool);
  emit('tool', updatedTool);
  return { status: 200, tool: updatedTool };
}

function computedToolChanges(oldTool: ToolDoc, newTool: ToolDoc): ToolDoc {
  // Set the orderedOn date if onOrder is newly set to true
  if (newTool.onOrder && !oldTool.onOrder) newTool.orderedOn = new Date().toISOString();
  // Assume if the current stock has increased that the order has been fulfilled
  if (newTool.stock > oldTool.stock) newTool.onOrder = false;
  return newTool;
}

export default {
  list,
  findById,
  findByScanCode,
  add,
  update,
  getAutoReorders,
  pick,
  stock,
};
