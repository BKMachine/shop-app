import type {
  CreateVendorPayload,
  UpdateVendorPayload,
} from '../../../server/api/routes/vendors.js';
import { emit } from '../../../server/sockets.js';
import AuditService from '../audit/audit_service.js';
import Vendor from './vendor_model.js';

async function list(): Promise<VendorDoc[]> {
  return Vendor.find({});
}

async function findById(id: string): Promise<VendorDoc | null> {
  return Vendor.findById(id);
}

async function create(data: CreateVendorPayload, deviceId: string): Promise<VendorDoc> {
  const vendor = new Vendor(data);
  await vendor.save();
  await AuditService.addVendorAudit(null, vendor, deviceId);
  emit('vendor', vendor);
  return vendor;
}

async function update(data: UpdateVendorPayload, deviceId: string): Promise<VendorDoc> {
  const oldVendor = await Vendor.findById(data._id);
  if (!oldVendor) throw new Error(`Missing vendor document id: ${data._id}`);
  const updatedVendor = await Vendor.findByIdAndUpdate(data._id, data, { returnDocument: 'after' });
  if (!updatedVendor) throw new Error(`Unable to update vendor document id: ${data._id}`);
  await AuditService.addVendorAudit(oldVendor, updatedVendor, deviceId);
  emit('vendor', updatedVendor);
  return updatedVendor;
}

export default {
  list,
  findById,
  create,
  update,
};
