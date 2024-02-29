import ToolModel from './tool_model';

async function list() {
  return ToolModel.find({});
}

async function findById(id: string) {
  return ToolModel.findById(id);
}

async function add(data: Tool) {
  const doc = new ToolModel(data);
  await doc.save();
  return doc;
}

async function update(doc: ToolDoc) {
  await ToolModel.findByIdAndUpdate(doc._id, doc);
}

async function getReorders() {
  return ToolModel.find({ $expr: { $lte: ['$stock', '$reorderThreshold'] } }).populate('_vendor');
}

export default {
  list,
  findById,
  add,
  update,
  getReorders,
};
