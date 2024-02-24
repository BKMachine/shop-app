import { Schema, model } from 'mongoose';

const schema = new Schema<ToolDoc>({
  description: String,
  item: String,
  manufacturer: String,
  vendor: String,
  stock: Number,
  price: Number,
  productPage: String,
  img: String,
});

export default model<ToolDoc>('tools', schema);
