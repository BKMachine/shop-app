import { model, Schema } from 'mongoose';

const schema = new Schema<PartNoteDoc>(
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

export default model<PartNoteDoc>('part_notes', schema);
