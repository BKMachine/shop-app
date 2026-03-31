import { SERVER_DEVICE_ID } from '@repo/utilities/constants';
import Audit from '../audit/audit_service.js';
import Customer from './customer_model.js';

async function list(): Promise<CustomerDoc[]> {
  return Customer.find({});
}

async function findById(id: string): Promise<CustomerDoc | null> {
  return Customer.findById(id);
}

async function create(data: CustomerDoc, device = SERVER_DEVICE_ID) {
  const doc = new Customer(data);
  await doc.save();
  await Audit.addCustomerAudit(null, doc, device);
  return doc;
}

async function update(doc: CustomerDoc, device = SERVER_DEVICE_ID) {
  const oldDoc = await Customer.findById(doc._id);
  if (!oldDoc) throw new Error(`Missing customer document id: ${doc._id}`);
  const updated = await Customer.findByIdAndUpdate(doc._id, doc, { returnDocument: 'after' });
  if (!updated) throw new Error(`Unable to update customer document id: ${doc._id}`);
  await Audit.addCustomerAudit(oldDoc, updated, device);
  return updated;
}

export default {
  list,
  findById,
  create,
  update,
};
