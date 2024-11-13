import { Schema, Types, model } from 'mongoose';

const schema = new Schema<ImageDoc>({
  filename: String,
  path: String,
  uploadDate: { type: Date, default: Date.now },
  ref: Types.ObjectId,
  type: String,
});

export default model<ImageDoc>('images', schema);
