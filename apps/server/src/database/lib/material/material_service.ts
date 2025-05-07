import Material from './material_model.js';

async function list(): Promise<MaterialDoc[]> {
  return await Material.find();
}

async function add(material: Material): Promise<MaterialDoc> {
  const doc = new Material(material);
  await doc.save();
  return doc;
}

async function update(material: Material): Promise<MaterialDoc | null> {
  return await Material.findByIdAndUpdate(material._id, material, { new: true });
}

export default {
  list,
  add,
  update,
};
