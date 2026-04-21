import { emit } from '../../../server/sockets.js';
import AuditService from '../audit/audit_service.js';
import Customer, { type CustomerDoc } from './customer_model.js';

async function list(): Promise<CustomerDoc[]> {
  return Customer.find({});
}

async function findById(id: string): Promise<CustomerDoc | null> {
  return Customer.findById(id);
}

async function create(data: CustomerCreate, deviceId: string): Promise<CustomerDoc> {
  const customer = new Customer(data);
  await customer.save();
  await AuditService.addCustomerAudit(null, customer, deviceId);
  emit('customer', customer);
  return customer;
}

async function update(data: CustomerUpdate, deviceId: string): Promise<CustomerDoc> {
  const customerId = data._id;
  const oldCustomer = await Customer.findById(customerId);
  if (!oldCustomer) throw new Error(`Missing customer document id: ${customerId}`);
  const updatedCustomer = await Customer.findByIdAndUpdate(customerId, data, {
    returnDocument: 'after',
  });
  if (!updatedCustomer) throw new Error(`Unable to update customer document id: ${customerId}`);
  await AuditService.addCustomerAudit(oldCustomer, updatedCustomer, deviceId);
  emit('customer', updatedCustomer);
  return updatedCustomer;
}

export default {
  list,
  findById,
  create,
  update,
};
