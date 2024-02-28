import { Schema, Types, model } from 'mongoose';

const schema = new Schema<ToolDoc>({
  description: { type: String, required: true },
  _vendor: { type: Types.ObjectId, ref: 'vendors' },
  item: { type: String, unique: true },
  barcode: { type: String, unique: true },
  stock: { type: Number, default: 0 },
  img: String,
  type: { type: String, required: true },
  coating: String,
  flutes: Number,
  autoReorder: Boolean,
  reorderQty: Number,
  reorderThreshold: Number,
});

export default model<ToolDoc>('tools', schema);
