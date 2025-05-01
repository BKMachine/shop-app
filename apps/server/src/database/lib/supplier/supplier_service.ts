import Supplier from './supplier_model.js';

async function list() {
  return Supplier.find({});
}

async function create(data: SupplierDoc) {
  const doc = new Supplier(data);
  await doc.save();
  return doc;
}

async function update(doc: SupplierDoc) {
  await Supplier.findByIdAndUpdate(doc._id, doc);
}

export default {
  list,
  create,
  update,
};
