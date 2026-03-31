import { SERVER_DEVICE_ID } from '@repo/utilities/constants';
import Audit from '../audit/audit_service.js';
import Vendor from './vendor_model.js';

async function list(): Promise<VendorDoc[]> {
  return Vendor.find({});
}

async function findById(id: string): Promise<VendorDoc | null> {
  return Vendor.findById(id);
}

async function create(data: VendorDoc, device = SERVER_DEVICE_ID): Promise<VendorDoc> {
  const doc = new Vendor(data);
  await doc.save();
  await Audit.addVendorAudit(null, doc, device);
  return doc;
}

async function update(doc: VendorDoc, device = SERVER_DEVICE_ID): Promise<VendorDoc | null> {
  const oldDoc = await Vendor.findById(doc._id);
  if (!oldDoc) throw new Error(`Missing vendor document id: ${doc._id}`);
  const updated = await Vendor.findByIdAndUpdate(doc._id, doc, { returnDocument: 'after' });
  if (!updated) throw new Error(`Unable to update vendor document id: ${doc._id}`);
  await Audit.addVendorAudit(oldDoc, updated, device);
  return updated;
}

export default {
  list,
  findById,
  create,
  update,
};
