import VendorModel from './vendor_model';

async function list() {
  return VendorModel.find();
}

async function create(data: VendorDoc) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, ...rest } = data;
  const doc = new VendorModel(rest);
  await doc.save();
  return doc;
}

async function update(doc: VendorDoc) {
  await VendorModel.findByIdAndUpdate(doc._id, doc);
}

export default {
  list,
  create,
  update,
};
