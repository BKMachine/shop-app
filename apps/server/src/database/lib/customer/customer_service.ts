import type {
  CreateCustomerPayload,
  UpdateCustomerPayload,
} from '../../../server/api/routes/customers.js';
import AuditService from '../audit/audit_service.js';
import Customer from './customer_model.js';

async function list(): Promise<CustomerDoc[]> {
  return Customer.find({});
}

async function findById(id: string): Promise<CustomerDoc | null> {
  return Customer.findById(id);
}

async function create(data: CreateCustomerPayload, deviceId: string): Promise<CustomerDoc> {
  const customer = new Customer(data);
  await customer.save();
  await AuditService.addCustomerAudit(null, customer, deviceId);
  return customer;
}

async function update(data: UpdateCustomerPayload, deviceId: string): Promise<CustomerDoc> {
  const oldCustomer = await Customer.findById(data._id);
  if (!oldCustomer) throw new Error(`Missing customer document id: ${data._id}`);
  const updatedCustomer = await Customer.findByIdAndUpdate(data._id, data, {
    returnDocument: 'after',
  });
  if (!updatedCustomer) throw new Error(`Unable to update customer document id: ${data._id}`);
  await AuditService.addCustomerAudit(oldCustomer, updatedCustomer, deviceId);
  return updatedCustomer;
}

export default {
  list,
  findById,
  create,
  update,
};
