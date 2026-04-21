import { type HydratedDocument, model, Schema, Types } from 'mongoose';

type PartDocumentFields = Omit<PartFields, 'customer' | 'material'> & {
  customer: Types.ObjectId;
  material?: Types.ObjectId | null;
  img?: string;
  createdAt: Date;
  imageIds?: Types.ObjectId[];
  documentIds?: Types.ObjectId[];
  derived?: PartDerived;
};

const schema = new Schema<PartDocumentFields>({
  part: { type: String, required: true },
  description: { type: String, required: true },
  customer: { type: Types.ObjectId, ref: 'customers', required: true },
  stock: { type: Number, default: 0 },
  location: String,
  position: String,
  img: String,
  productLink: String,
  partFilesPath: String,
  revision: String,
  material: { type: Types.ObjectId, ref: 'materials', default: null },
  customerSuppliedMaterial: { type: Boolean, default: false },
  materialCutType: { type: String, enum: ['blanks', 'bars'], default: 'blanks' },
  materialLength: { type: Number, default: 0 },
  barLength: { type: Number, default: 0 },
  remnantLength: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  cycleTimes: [{ operation: String, time: Number }],
  additionalCosts: [{ name: String, cost: Number, url: String }],
  price: { type: Number, default: 0 },
  subComponentIds: [
    {
      partId: { type: Types.ObjectId, ref: 'parts', required: true },
      qty: { type: Number, default: 1, min: 1 },
    },
  ],
  imageIds: [{ type: Types.ObjectId, ref: 'images' }],
  documentIds: [{ type: Types.ObjectId, ref: 'documents' }],
  derived: {
    shopRate: { type: Number, default: 0 },
    directSubComponentCount: { type: Number, default: 0 },
    directParentCount: { type: Number, default: 0 },
  },
});

schema.index({ 'subComponentIds.partId': 1 });

export default model<PartDocumentFields>('parts', schema);
export type PartDoc = HydratedDocument<PartDocumentFields>;
