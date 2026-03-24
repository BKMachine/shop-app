import { SERVER_DEVICE_ID } from '@repo/utilities/constants';
import { emit } from '../../../server/sockets.js';
import Audit from '../audit/audit_service.js';
import Part from './part_model.js';

async function list(): Promise<PartDoc[]> {
  return Part.find({});
}

async function findById(id: string): Promise<PartDoc | null> {
  return Part.findById(id).populate('customer').populate('material');
}

async function add(data: PartDoc, device = SERVER_DEVICE_ID): Promise<PartDoc> {
  const part = new Part(data);
  await part.save();
  emit('part', part);
  await Audit.addPartAudit(null, part, device);
  return part;
}

async function update(newPart: PartDoc, device = SERVER_DEVICE_ID): Promise<PartDoc | null> {
  const id = newPart._id;
  const oldPart: PartDoc | null = await Part.findById(id);
  if (!oldPart) throw new Error(`Missing part document id: ${id}`);
  const updatedPart = await Part.findByIdAndUpdate(id, newPart, { returnDocument: 'after' });
  if (!updatedPart) throw new Error(`Unable to update part document id: ${id}`);
  emit('part', updatedPart);
  await Audit.addPartAudit(oldPart, updatedPart, device);
  return updatedPart;
}

export default {
  list,
  findById,
  add,
  update,
};
