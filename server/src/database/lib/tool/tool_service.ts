import { emit } from '../../../server/sockets';
import Tool from './tool_model';

async function list() {
  return Tool.find({});
}

async function findById(id: string) {
  return Tool.findById(id).populate('vendor');
}

async function add(data: ToolDoc) {
  const doc = new Tool(data);
  await doc.save();
  return doc;
}

async function update(doc: ToolDoc_Pop) {
  const newDoc = {
    ...doc,
    vendor: typeof doc.vendor === 'object' ? doc.vendor._id : doc.vendor,
    supplier: typeof doc.supplier === 'object' ? doc.supplier._id : doc.supplier,
  };
  const oldDoc = (await Tool.findById(newDoc._id)) as ToolDoc;
  if (!oldDoc) throw new Error('Missing Tool Document');
  // Set the orderedOn date if onOrder is newly set to true
  if (newDoc.onOrder && !oldDoc.onOrder) newDoc.orderedOn = new Date().toISOString();
  // Assume if the current stock is now greater than the reorderThreshold that the order has been fulfilled
  if (newDoc.reorderThreshold > 0 && newDoc.stock > newDoc.reorderThreshold) newDoc.onOrder = false;
  const updatedTool = await Tool.findByIdAndUpdate(newDoc._id, newDoc, { new: true });
  emit('tool', updatedTool);
  return updatedTool;
}

async function getAutoReorders() {
  return Tool.find({
    $expr: { $lte: ['$stock', '$reorderThreshold'] },
    autoReorder: true,
  })
    .populate('vendor')
    .populate('supplier');
}

async function pick(scanCode: string): Promise<{ status: number; tool: ToolDoc_Pop | null }> {
  const tool = await Tool.findOne({
    $or: [{ item: scanCode }, { barcode: scanCode }],
  })
    .populate('vendor')
    .populate('supplier');
  if (!tool) return { status: 404, tool: null };
  if (tool.stock <= 0) return { status: 400, tool: null };
  tool.stock--;
  await tool.save();
  emit('tool', tool);
  return { status: 200, tool: tool as ToolDoc_Pop };
}

export default {
  list,
  findById,
  add,
  update,
  getAutoReorders,
  pick,
};
