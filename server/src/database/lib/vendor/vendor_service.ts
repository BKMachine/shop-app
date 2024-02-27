import VendorModel from './vendor_model';

async function list() {
  return VendorModel.find();
}

async function create(data: Vendor) {
  const doc = new VendorModel(data);
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
