import { emit } from '../../../server/sockets.js';
import Audit from '../audit/audit_service.js';
import Part from './part_model.js';

async function list(): Promise<PartDoc[]> {
  return Part.find({});
}

async function findById(id: string): Promise<PartDoc | null> {
  return Part.findById(id).populate('customer');
}
/*
async function findByScanCode(scanCode: string): Promise<ToolDoc | null> {
  return Tool.findOne({
    $or: [{ item: scanCode }, { barcode: scanCode }],
  })
    .populate('vendor')
    .populate('supplier');
}

async function getAutoReorders(): Promise<ToolDocReorders[]> {
  return Tool.find({
    $expr: { $lte: ['$stock', '$reorderThreshold'] },
    autoReorder: true,
  })
    .populate('vendor')
    .populate('supplier');
}/**/

async function add(data: PartDoc): Promise<PartDoc> {
  const part = new Part(data);
  await part.save();
  await Audit.addPartAudit(null, part);
  emit('part', part);
  return part;
}

async function update(newPart: PartDoc): Promise<PartDoc | null> {
  const id = newPart._id;
  const oldPart: PartDoc | null = await Part.findById(id);
  if (!oldPart) throw new Error(`Missing part document id: ${id}`);
  const updatedPart = await Part.findByIdAndUpdate(id, newPart, { new: true });
  if (!updatedPart) throw new Error(`Unable to update part document id: ${id}`);
  await Audit.addPartAudit(oldPart, updatedPart);
  emit('part', updatedPart);
  return updatedPart;
}

/*
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
}*/

export default {
  list,
  findById,
  // findByScanCode,
  add,
  update,
  /*  getAutoReorders,
  pick,
  stock,*/
};
