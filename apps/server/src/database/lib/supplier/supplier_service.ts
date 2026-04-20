import type {
  CreateSupplierPayload,
  UpdateSupplierPayload,
} from '../../../server/api/routes/suppliers.js';
import AuditService from '../audit/audit_service.js';
import Supplier from './supplier_model.js';

async function list(): Promise<SupplierDoc[]> {
  return Supplier.find({});
}

async function findById(id: string): Promise<SupplierDoc | null> {
  return Supplier.findById(id);
}

async function create(data: CreateSupplierPayload, deviceId: string): Promise<SupplierDoc> {
  const supplier = new Supplier(data);
  await supplier.save();
  await AuditService.addSupplierAudit(null, supplier, deviceId);
  return supplier;
}

async function update(data: UpdateSupplierPayload, deviceId: string): Promise<SupplierDoc> {
  const oldSupplier = await Supplier.findById(data._id);
  if (!oldSupplier) throw new Error(`Missing supplier document id: ${data._id}`);
  const updatedSupplier = await Supplier.findByIdAndUpdate(data._id, data, {
    returnDocument: 'after',
  });
  if (!updatedSupplier) throw new Error(`Unable to update supplier document id: ${data._id}`);
  await AuditService.addSupplierAudit(oldSupplier, updatedSupplier, deviceId);
  return updatedSupplier;
}

export default {
  list,
  findById,
  create,
  update,
};
