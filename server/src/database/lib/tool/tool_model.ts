import { Schema, Types, model } from 'mongoose';

const schema = new Schema<ToolDoc>({
  description: { type: String, required: true },
  vendor: { type: Types.ObjectId, ref: 'vendors' },
  item: { type: String, unique: true },
  barcode: { type: String, unique: true },
  stock: { type: Number, default: 0 },
  img: String,
  category: { type: String, required: true },
  coating: String,
  flutes: Number,
  autoReorder: { type: Boolean, default: false },
  reorderQty: { type: Number, default: 0 },
  reorderThreshold: { type: Number, default: 0 },
  productLink: String,
  techDataLink: String,
  cost: Number,
  onOrder: { type: Boolean, default: false },
  orderedOn: Date,
});

export default model<ToolDoc>('tools', schema);
