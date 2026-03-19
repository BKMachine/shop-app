import normalizeDimensions from '@repo/utilities/normalizeDimensions';
import { emit } from '../../../server/sockets.js';
import Audit from '../audit/audit_service.js';
import Material from './material_model.js';

async function list(): Promise<MaterialDoc[]> {
  return await Material.find();
}

async function add(data: Material, device: string): Promise<MaterialDoc> {
  const material = new Material(normalizeDimensions(data));
  await material.save();
  await Audit.addMaterialAudit(null, material, device);
  emit('material', material);
  return material;
}

async function update(newMaterial: Material, device: string): Promise<MaterialDoc | null> {
  const id = newMaterial._id;
  const oldMaterial: MaterialDoc | null = await Material.findById(id);
  if (!oldMaterial) throw new Error(`Missing material document id: ${id}`);
  const updatedMaterial = await Material.findByIdAndUpdate(id, normalizeDimensions(newMaterial), {
    returnDocument: 'after',
  });
  if (!updatedMaterial) throw new Error(`Unable to update material document id: ${id}`);
  await Audit.addMaterialAudit(oldMaterial, updatedMaterial, device);
  emit('material', updatedMaterial);
  return updatedMaterial;
}

async function find(data: Material): Promise<MaterialDoc | null> {
  return await Material.findOne(normalizeDimensions(data));
}

async function updateCostPerFoot(id: string, costPerFoot: number): Promise<MaterialDoc | null> {
  const oldMaterial: MaterialDoc | null = await Material.findById(id);
  if (!oldMaterial) throw new Error(`Missing material document id: ${id}`);
  const updatedMaterial = await Material.findByIdAndUpdate(
    id,
    { costPerFoot },
    { returnDocument: 'after' },
  );
  if (!updatedMaterial) throw new Error(`Unable to update material document id: ${id}`);
  await Audit.addMaterialAudit(
    oldMaterial,
    updatedMaterial,
    '77f542a0-c09e-4b14-9634-40f2ede31a3e',
  );
  return updatedMaterial;
}

export default {
  list,
  add,
  update,
  find,
  updateCostPerFoot,
};
