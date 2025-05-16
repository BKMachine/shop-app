import { emit } from '../../../server/sockets.js';
import Audit from '../audit/audit_service.js';
import Part from './part_model.js';

async function list(): Promise<PartDoc[]> {
  return Part.find({});
}

async function findById(id: string): Promise<PartDoc | null> {
  return Part.findById(id).populate('customer').populate('material');
}

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

export default {
  list,
  findById,
  add,
  update,
};
