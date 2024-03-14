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

async function update(doc: ToolDoc) {
  const oldDoc = (await Tool.findById(doc._id)) as ToolDoc;
  if (!oldDoc) throw new Error('Missing Tool Document');
  // Set the orderedOn date if onOrder is newly set to true
  if (doc.onOrder && !oldDoc.onOrder) doc.orderedOn = new Date().toISOString();
  // Assume if the current stock is now greater than the reorderThreshold that the order has been fulfilled
  if (doc.reorderThreshold > 0 && doc.stock > doc.reorderThreshold) doc.onOrder = false;
  return Tool.findByIdAndUpdate(doc._id, doc, { new: true });
}

async function getAutoReorders() {
  return Tool.find({
    $expr: { $lte: ['$stock', '$reorderThreshold'] },
    autoReorder: true,
  }).populate('vendor');
}

async function pick(scanCode: string): Promise<{ status: number; message: string }> {
  const tool = await Tool.findOne({
    $or: [{ item: scanCode }, { barcode: scanCode }],
  });
  if (!tool) return { status: 404, message: 'Tool not found.' };
  if (tool.stock <= 0) return { status: 400, message: 'Cannot pick a tool with 0 stock.' };
  tool.stock--;
  await tool.save();
  return { status: 200, message: `Tool picked. ${tool.stock} remaining.` };
}

export default {
  list,
  findById,
  add,
  update,
  getAutoReorders,
  pick,
};
