import { materialPieceForms } from '@repo/utilities/materials';
import { type HydratedDocument, model, Schema, type Types } from 'mongoose';

type MaterialDocumentFields = Omit<MaterialFields, 'supplier'> & {
  supplier: Types.ObjectId | null;
};

function isStock(this: MaterialDocumentFields) {
  return this.kind !== 'piece';
}

function isPiece(this: MaterialDocumentFields) {
  return this.kind === 'piece';
}

const schema = new Schema<MaterialDocumentFields>({
  description: { type: String, required: true },
  kind: { type: String, enum: ['stock', 'piece'], default: 'stock' },
  type: { type: String, enum: ['Flat', 'Round', null], default: null, required: isStock },
  form: { type: String, enum: [...materialPieceForms, null], default: null, required: isPiece },
  name: { type: String, trim: true, default: null },
  isMetric: { type: Boolean, default: false },
  height: { type: Number, default: null },
  width: { type: Number, default: null },
  diameter: { type: Number, default: null },
  wallThickness: { type: Number, default: null },
  length: { type: Number, default: null },
  materialType: { type: String, required: true },
  supplier: { type: Schema.Types.ObjectId, ref: 'suppliers', default: null, required: isStock },
  costPerFoot: { type: Number, default: null },
  costPerPiece: { type: Number, default: null },
});

export default model<MaterialDocumentFields>('materials', schema);
export type MaterialDoc = HydratedDocument<MaterialDocumentFields>;
