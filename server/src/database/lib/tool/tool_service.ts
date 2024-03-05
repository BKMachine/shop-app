import Tool from './tool_model';

async function list() {
  return Tool.find({});
}

async function findById(id: string) {
  return Tool.findById(id);
}

async function add(data: ToolDoc) {
  const doc = new Tool(data);
  await doc.save();
  return doc;
}

async function update(doc: ToolDoc) {
  return Tool.findByIdAndUpdate(doc._id, doc, { new: true });
}

async function getAutoReorders() {
  return Tool.find({
    $expr: { $lte: ['$stock', '$reorderThreshold'] },
    autoReorder: true,
  }).populate('vendor');
}

export default {
  list,
  findById,
  add,
  update,
  getAutoReorders,
};
