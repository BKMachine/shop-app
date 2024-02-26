import { Schema, model } from 'mongoose';

const schema = new Schema<ToolDoc>({
  description: String,
  vendor: String,
  item: String,
  stock: Number,
  img: String,
});

export default model<ToolDoc>('tools', schema);
