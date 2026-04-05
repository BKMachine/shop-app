import { normalizeDimensions } from '@repo/utilities/materials';
import { emit } from '../../../server/sockets.js';
import Audit from '../audit/audit_service.js';
import Material from './material_model.js';

async function list(): Promise<MaterialDoc[]> {
  return await Material.find();
}

async function add(data: Material, deviceId: string): Promise<MaterialDoc> {
  const material = new Material(normalizeDimensions(data));
  await material.save();
  await Audit.addMaterialAudit(null, material, deviceId);
  emit('material', material);
  return material;
}

async function update(newMaterial: Material, deviceId: string): Promise<MaterialDoc | null> {
  const id = newMaterial._id;
  const oldMaterial: MaterialDoc | null = await Material.findById(id);
  if (!oldMaterial) throw new Error(`Missing material document id: ${id}`);
  const updatedMaterial = await Material.findByIdAndUpdate(id, normalizeDimensions(newMaterial), {
    returnDocument: 'after',
  });
  if (!updatedMaterial) throw new Error(`Unable to update material document id: ${id}`);
  await Audit.addMaterialAudit(oldMaterial, updatedMaterial, deviceId);
  emit('material', updatedMaterial);
  return updatedMaterial;
}

async function find(data: Material): Promise<MaterialDoc | null> {
  return await Material.findOne(normalizeDimensions(data));
}

async function findByParsedMaterial(data: Partial<Material>): Promise<MaterialDoc | null> {
  if (!data.materialType || !data.type) {
    return null;
  }

  const query = {
    materialType: data.materialType,
    type: data.type,
    height: data.height ?? null,
    width: data.width ?? null,
    diameter: data.diameter ?? null,
    wallThickness: data.wallThickness ?? null,
    length: data.length ?? null,
  };

  return await Material.findOne(normalizeDimensions(query));
}

async function updateCostPerFoot(
  id: string,
  costPerFoot: number,
  deviceId: string,
): Promise<MaterialDoc | null> {
  const oldMaterial: MaterialDoc | null = await Material.findById(id);
  if (!oldMaterial) throw new Error(`Missing material document id: ${id}`);
  const updatedMaterial = await Material.findByIdAndUpdate(
    id,
    { costPerFoot },
    { returnDocument: 'after' },
  );
  if (!updatedMaterial) throw new Error(`Unable to update material document id: ${id}`);
  await Audit.addMaterialAudit(oldMaterial, updatedMaterial, deviceId);
  emit('material', updatedMaterial);
  return updatedMaterial;
}

export default {
  list,
  add,
  update,
  find,
  findByParsedMaterial,
  updateCostPerFoot,
};
