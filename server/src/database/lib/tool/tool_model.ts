import { Schema, Types, model } from 'mongoose';

const schema = new Schema<ToolDoc>({
  description: String,
  _vendor: { type: Types.ObjectId, ref: 'vendors' },
  item: { type: String, unique: true },
  stock: Number,
  img: String,
});

export default model<ToolDoc>('tools', schema);
