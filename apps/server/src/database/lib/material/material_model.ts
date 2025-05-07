import { Schema, model } from 'mongoose';

const schema = new Schema<MaterialDoc>({
  description: { type: String, required: true },
  type: { type: String, enum: ['Round', 'Flat'], required: true },
  height: { type: Number, default: null },
  width: { type: Number, default: null },
  diameter: { type: Number, default: null },
  wallThickness: { type: Number, default: null },
  length: { type: Number, default: null },
  materialType: { type: String, required: true },
  supplier: { type: Schema.Types.ObjectId, ref: 'suppliers', default: null },
});

export default model<MaterialDoc>('materials', schema);
