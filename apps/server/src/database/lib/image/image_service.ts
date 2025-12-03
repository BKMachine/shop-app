import Image from './image_model.js';

async function add(data: unknown): Promise<ImageDoc> {
  const doc = new Image(data);
  await doc.save();
  return doc;
}

async function update(image: Image): Promise<ImageDoc | null> {
  return await Image.findByIdAndUpdate(
    image._id,
    { ...image, updatedAt: new Date() },
    { new: true },
  );
}

async function listRecents(limit = 50): Promise<ImageDoc[]> {
  return Image.find({ status: 'temp' }).sort({ createdAt: -1 }).limit(limit);
}

export default {
  add,
  update,
  listRecents,
};
