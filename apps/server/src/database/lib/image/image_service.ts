import Image from './image_model.js';

async function add(data: unknown): Promise<ImageDoc> {
  const doc = new Image(data);
  await doc.save();
  return doc;
}

async function update(image: ImageDoc): Promise<ImageDoc | null> {
  return await Image.findByIdAndUpdate(
    image._id,
    { ...image, updatedAt: new Date() },
    { new: true },
  );
}

async function listRecents(limit = 50): Promise<ImageDoc[]> {
  return Image.find({ status: 'temp' }).sort({ createdAt: -1 }).limit(limit);
}

async function findById(id: string): Promise<ImageDoc | null> {
  return Image.findById(id);
}

export default {
  add,
  update,
  listRecents,
  findById,
};
