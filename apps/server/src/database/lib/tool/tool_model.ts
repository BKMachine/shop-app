import { model, Schema, Types } from 'mongoose';

const schema = new Schema<ToolDoc>({
  description: { type: String, required: true },
  vendor: { type: Types.ObjectId, ref: 'vendors' },
  supplier: { type: Types.ObjectId, ref: 'suppliers' },
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
  cost: { type: Number, default: 0 },
  onOrder: { type: Boolean, default: false },
  orderedOn: Date,
  location: String,
  position: String,
  cuttingDia: Number,
  fluteLength: Number,
  toolType: String,
});

export default model<ToolDoc>('tools', schema);
