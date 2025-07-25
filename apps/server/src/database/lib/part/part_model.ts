import { model, Schema, Types } from 'mongoose';

const schema = new Schema<PartDoc>({
  part: { type: String, required: true },
  description: { type: String, required: true },
  customer: { type: Types.ObjectId, ref: 'customers', required: true },
  stock: { type: Number, default: 0 },
  location: String,
  position: String,
  img: String,
  revision: String,
  material: { type: Types.ObjectId, ref: 'materials', default: null },
  materialLength: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

export default model<PartDoc>('parts', schema);
