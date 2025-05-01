import Customer from './customer_model.js';

async function list() {
  return Customer.find({});
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
  create,
  update,
};
