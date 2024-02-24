import SupplierModel from './supplier_model';

async function list() {
  return SupplierModel.find();
}

async function create(data: SupplierDoc) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, ...rest } = data;
  const doc = new SupplierModel(rest);
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
