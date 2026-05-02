import { type HydratedDocument, model, Schema, type Types } from 'mongoose';

type ImageDocumentFields = Omit<ImageFields, 'entityId'> & {
  entityId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

const schema = new Schema<ImageDocumentFields>(
  {
    filename: { type: String, required: true },
    relPath: { type: String, required: true },
    mimeType: { type: String },
    ocrText: { type: String, default: '' },
    status: {
      type: String,
      enum: ['temp', 'attached'],
      default: 'temp',
      index: true,
    },
    entityType: {
      type: String,
      enum: ['tool', 'part', 'customer', 'supplier', 'shipper', 'vendor', 'shipment', null],
      default: null,
      index: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

export default model<ImageDocumentFields>('images', schema);
export type ImageDoc = HydratedDocument<ImageDocumentFields>;
