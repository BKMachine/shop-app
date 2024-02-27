import SupplierModel from './supplier_model';

async function list() {
  return SupplierModel.find();
}

async function create(data: Supplier) {
  const doc = new SupplierModel(data);
  await doc.save();
  return doc;
}

async function update(doc: SupplierDoc) {
  await SupplierModel.findByIdAndUpdate(doc._id, doc);
}

export default {
  list,
  create,
  update,
};
