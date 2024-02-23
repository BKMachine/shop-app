import Manufacturer from './manufacturer_model';

async function listAll() {
  return Manufacturer.find();
}

async function create(data: ToolManufacturer) {
  const doc = new Manufacturer({
    name: data.name,
    logo: data.logo,
  });
  await doc.save();
  return doc;
}

async function update(doc: ToolManufacturerDoc) {
  await Manufacturer.findByIdAndUpdate(doc._id, doc);
}

export default {
  listAll,
  create,
  update,
};
