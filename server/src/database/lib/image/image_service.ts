import Image from './image_model';

async function save(filename: string, path: string, id: string, type: string) {
  const newImage = new Image({ filename, path, ref: id, type });
  await newImage.save();
}

export default {
  save,
};
