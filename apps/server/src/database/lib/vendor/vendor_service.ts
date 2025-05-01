import Vendor from './vendor_model.js';

async function list() {
  return Vendor.find({});
}

async function create(data: VendorDoc) {
  const doc = new Vendor(data);
  await doc.save();
  return doc;
}

async function update(doc: VendorDoc) {
  await Vendor.findByIdAndUpdate(doc._id, doc);
}

export default {
  list,
  create,
  update,
};
