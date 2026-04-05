import Audit from '../audit/audit_service.js';
import Supplier from './supplier_model.js';

async function list(): Promise<SupplierDoc[]> {
  return Supplier.find({});
}

async function findById(id: string): Promise<SupplierDoc | null> {
  return Supplier.findById(id);
}

async function create(data: SupplierDoc, deviceId: string): Promise<SupplierDoc> {
  const doc = new Supplier(data);
  await doc.save();
  await Audit.addSupplierAudit(null, doc, deviceId);
  return doc;
}

async function update(doc: SupplierDoc, deviceId: string): Promise<SupplierDoc | null> {
  const oldDoc = await Supplier.findById(doc._id);
  if (!oldDoc) throw new Error(`Missing supplier document id: ${doc._id}`);
  const updated = await Supplier.findByIdAndUpdate(doc._id, doc, { returnDocument: 'after' });
  if (!updated) throw new Error(`Unable to update supplier document id: ${doc._id}`);
  await Audit.addSupplierAudit(oldDoc, updated, deviceId);
  return updated;
}

export default {
  list,
  findById,
  create,
  update,
};
