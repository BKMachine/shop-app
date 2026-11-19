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

const routingOperationSchema = new Schema<RoutingOperation>(
  {
    op: { type: Number, required: true },
    operation: { type: String, default: '' },
    // Department _id, 'other', or null while unassigned.
    department: { type: String, default: null },
    time: { type: Number, default: 0 },
    noCycleTime: { type: Boolean, default: false },
  },
  // Each op keeps an `_id` through reorders, so schedule bookings can point at it.
  { _id: true },
);

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
  blanksPerPart: { type: Number, default: 1, min: 1 },
  barLength: { type: Number, default: 0 },
  remnantLength: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  // Legacy `cycleTimes` stays in stored documents until it is dropped after the routing rollout;
  // migratePartRoutingFromCycleTimes copies it into `routing`.
  routing: { type: [routingOperationSchema], default: undefined },
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
    hasIncompleteSubComponentCosts: { type: Boolean, default: false },
  },
  needsReview: { type: Boolean, default: true },
});

schema.index({ 'subComponentIds.partId': 1 });

export default model<PartDocumentFields>('parts', schema);
export type PartDoc = HydratedDocument<PartDocumentFields>;
