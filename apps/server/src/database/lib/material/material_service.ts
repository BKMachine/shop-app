import { normalizeDimensions } from '@repo/utilities/materials';
import { emit } from '../../../server/sockets.js';
import Audit from '../audit/audit_service.js';
import Material from './material_model.js';

async function list(): Promise<MaterialDoc[]> {
  return await Material.find();
}

async function add(
  data: Material,
  device: string,
  auditTimestamp?: Date | string,
): Promise<MaterialDoc> {
  const material = new Material(normalizeDimensions(data));
  await material.save();
  await Audit.addMaterialAudit(null, material, device, auditTimestamp);
  emit('material', material);
  return material;
}

async function update(
  newMaterial: Material,
  device: string,
  auditTimestamp?: Date | string,
): Promise<MaterialDoc | null> {
  const id = newMaterial._id;
  const oldMaterial: MaterialDoc | null = await Material.findById(id);
  if (!oldMaterial) throw new Error(`Missing material document id: ${id}`);
  const updatedMaterial = await Material.findByIdAndUpdate(id, normalizeDimensions(newMaterial), {
    returnDocument: 'after',
  });
  if (!updatedMaterial) throw new Error(`Unable to update material document id: ${id}`);
  await Audit.addMaterialAudit(oldMaterial, updatedMaterial, device, auditTimestamp);
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

  const query: Partial<Material> = {
    materialType: data.materialType,
    type: data.type,
    height: data.height ?? null,
    width: data.width ?? null,
    diameter: data.diameter ?? null,
    wallThickness: data.wallThickness ?? null,
    length: data.length ?? null,
  };

  if (query.type === 'Flat' && query.width && query.height && query.width < query.height) {
    const temp = query.width;
    query.width = query.height;
    query.height = temp;
  }

  return await Material.findOne(query);
}

async function updateCostPerFoot(
  id: string,
  costPerFoot: number,
  device = '77f542a0-c09e-4b14-9634-40f2ede31a3e',
  auditTimestamp?: Date | string,
): Promise<MaterialDoc | null> {
  const oldMaterial: MaterialDoc | null = await Material.findById(id);
  if (!oldMaterial) throw new Error(`Missing material document id: ${id}`);
  const updatedMaterial = await Material.findByIdAndUpdate(
    id,
    { costPerFoot },
    { returnDocument: 'after' },
  );
  if (!updatedMaterial) throw new Error(`Unable to update material document id: ${id}`);
  await Audit.addMaterialAudit(oldMaterial, updatedMaterial, device, auditTimestamp);
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
