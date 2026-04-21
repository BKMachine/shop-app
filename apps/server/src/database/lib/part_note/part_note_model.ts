import { model, Schema, type Types } from 'mongoose';

type PartNoteDocumentFields = Omit<PartNoteFields, 'partId'> & {
  partId: Types.ObjectId;
};

const schema = new Schema<PartNoteDocumentFields>(
  {
    partId: {
      type: Schema.Types.ObjectId,
      ref: 'parts',
      required: true,
      index: true,
    },
    text: { type: String, required: true, trim: true },
    priority: {
      type: String,
      enum: ['critical', 'default'],
      default: 'default',
      index: true,
    },
    createdByDeviceId: { type: String, required: true },
    createdByDisplayName: { type: String, required: true },
    updatedByDeviceId: { type: String, required: true },
    updatedByDisplayName: { type: String, required: true },
  },
  {
    timestamps: true,
  },
);

export default model<PartNoteDocumentFields>('part_notes', schema);
