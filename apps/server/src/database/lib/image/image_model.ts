import { model, Schema } from 'mongoose';

const schema = new Schema<ImageDoc>(
  {
    filename: { type: String, required: true },
    relPath: { type: String, required: true },
    mimeType: { type: String },

    status: {
      type: String,
      enum: ['temp', 'attached'],
      default: 'temp',
      index: true,
    },

    // What this image is used for (optional polymorphic association)
    entityType: {
      type: String,
      enum: ['tool', 'part', 'setup', null],
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

export default model<ImageDoc>('images', schema);
