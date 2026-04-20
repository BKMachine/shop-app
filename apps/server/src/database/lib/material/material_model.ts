import { model, Schema, type Types } from 'mongoose';

export type MaterialDocumentFields = MaterialFields & {
  supplier: Types.ObjectId;
};

const schema = new Schema<MaterialDocumentFields>({
  description: { type: String, required: true },
  type: { type: String, enum: ['Flat', 'Round'], required: true },
  height: { type: Number, default: null },
  width: { type: Number, default: null },
  diameter: { type: Number, default: null },
  wallThickness: { type: Number, default: null },
  length: { type: Number, default: null },
  materialType: { type: String, required: true },
  supplier: { type: Schema.Types.ObjectId, ref: 'suppliers', required: true },
  costPerFoot: { type: Number, default: null },
});

export default model<MaterialDocumentFields>('materials', schema);
