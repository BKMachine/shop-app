import Supplier from './supplier_model.js';

async function list(): Promise<SupplierDoc[]> {
  return Supplier.find({});
}

async function create(data: SupplierDoc): Promise<SupplierDoc> {
  const doc = new Supplier(data);
  await doc.save();
  return doc;
}

async function update(doc: SupplierDoc): Promise<SupplierDoc | null> {
  return await Supplier.findByIdAndUpdate(doc._id, doc, { new: true });
}

export default {
  list,
  create,
  update,
};
