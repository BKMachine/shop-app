import { Schema, Types, model } from 'mongoose';

const schema = new Schema<PartDoc>({
  part: { type: String, required: true },
  description: { type: String, required: true },
  customer: { type: Types.ObjectId, ref: 'customers', required: true },
  stock: { type: Number, default: 0 },
  location: String,
  position: String,
  img: String,
  revision: String,
});

export default model<PartDoc>('parts', schema);
