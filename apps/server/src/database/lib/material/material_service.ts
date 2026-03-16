import fixDims from '@repo/utilities/fixDims';
import { emit } from '../../../server/sockets.js';
import Audit from '../audit/audit_service.js';
import Material from './material_model.js';

async function list(): Promise<MaterialDoc[]> {
  return await Material.find();
}

async function add(data: Material): Promise<MaterialDoc> {
  const material = new Material(fixDims(data));
  await material.save();
  await Audit.addMaterialAudit(null, material);
  emit('material', material);
  return material;
}

async function update(newMaterial: Material): Promise<MaterialDoc | null> {
  const id = newMaterial._id;
  const oldMaterial: MaterialDoc | null = await Material.findById(id);
  if (!oldMaterial) throw new Error(`Missing material document id: ${id}`);
  const updatedMaterial = await Material.findByIdAndUpdate(id, fixDims(newMaterial), {
    returnDocument: 'after',
  });
  if (!updatedMaterial) throw new Error(`Unable to update material document id: ${id}`);
  await Audit.addMaterialAudit(oldMaterial, updatedMaterial);
  emit('material', updatedMaterial);
  return updatedMaterial;
}

export default {
  list,
  add,
  update,
};
