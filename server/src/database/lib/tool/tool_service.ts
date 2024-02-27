import ToolModel from './tool_model';

async function list() {
  return ToolModel.find({});
}

async function add(data: Tool) {
  const doc = new ToolModel(data);
  await doc.save();
  return doc;
}

async function update(doc: ToolDoc) {
  await ToolModel.findByIdAndUpdate(doc._id, doc);
}

export default {
  list,
  add,
  update,
};
