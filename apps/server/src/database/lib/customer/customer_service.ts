import Customer from './customer_model.js';

async function list(): Promise<CustomerDoc[]> {
  return Customer.find({});
}

async function findById(id: string): Promise<CustomerDoc | null> {
  return Customer.findById(id);
}

async function create(data: CustomerDoc) {
  const doc = new Customer(data);
  await doc.save();
  return doc;
}

async function update(doc: CustomerDoc) {
  await Customer.findByIdAndUpdate(doc._id, doc);
}

export default {
  list,
  findById,
  create,
  update,
};
