import { type HydratedDocument, model, Schema } from 'mongoose';

const labelOffsetSchema = new Schema<LabelOffset>(
  {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
  },
  { _id: false },
);

const schema = new Schema<MiscSettings>({
  _id: { type: String, default: 'misc-settings' },
  itemLabelOffset: {
    type: labelOffsetSchema,
    required: true,
    default: () => ({
      x: 0,
      y: 0,
    }),
  },
});

export default model<MiscSettings>('misc_settings', schema, 'misc_settings');
export type MiscSettingsDoc = HydratedDocument<MiscSettings>;
