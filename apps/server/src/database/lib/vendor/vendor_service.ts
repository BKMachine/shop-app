import Vendor from './vendor_model.js';

async function list(): Promise<VendorDoc[]> {
  return Vendor.find({});
}

async function create(data: VendorDoc): Promise<VendorDoc> {
  const doc = new Vendor(data);
  await doc.save();
  return doc;
}

async function update(doc: VendorDoc): Promise<VendorDoc | null> {
  return await Vendor.findByIdAndUpdate(doc._id, doc, { new: true });
}

export default {
  list,
  create,
  update,
};
