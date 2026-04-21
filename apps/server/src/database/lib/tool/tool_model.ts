import { type HydratedDocument, model, Schema, Types } from 'mongoose';

type ToolDocumentFields = Omit<ToolFields, 'vendor' | 'supplier'> & {
  vendor?: Types.ObjectId;
  supplier?: Types.ObjectId;
};

type ToolPopulatedFields = Omit<ToolDocumentFields, 'vendor' | 'supplier'> & {
  vendor?: Vendor | null;
  supplier?: Supplier | null;
};

const schema = new Schema<ToolDocumentFields>({
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
  orderLink: String,
  cost: { type: Number, default: 0 },
  onOrder: { type: Boolean, default: false },
  orderedOn: Date,
  location: String,
  position: String,
  cuttingDia: Number,
  fluteLength: Number,
  toolType: String,
});

export default model<ToolDocumentFields>('tools', schema);
export type ToolDoc = HydratedDocument<ToolDocumentFields>;
export type ToolPopulatedDoc = HydratedDocument<ToolPopulatedFields>;
