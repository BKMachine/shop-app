import { type HydratedDocument, model, Schema, type Types } from 'mongoose';

type StoredDocumentRecord = Omit<StoredDocumentFields, 'entityId'> & {
  entityId: Types.ObjectId | null;
};

const schema = new Schema<StoredDocumentRecord>(
  {
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    relPath: { type: String, required: true },
    mimeType: { type: String },
    extension: { type: String },
    size: { type: Number, required: true },
    entityType: {
      type: String,
      enum: ['part', null],
      default: null,
      index: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

export default model<StoredDocumentRecord>('documents', schema);
export type StoredDocumentDoc = HydratedDocument<StoredDocumentRecord>;
