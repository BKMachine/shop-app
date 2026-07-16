import { type HydratedDocument, model, Schema } from 'mongoose';

interface SequenceFields {
  key: string;
  value: number;
}

const schema = new Schema<SequenceFields>({
  key: { type: String, required: true, unique: true },
  value: { type: Number, required: true, default: 0 },
});

export default model<SequenceFields>('sequences', schema);
export type SequenceDoc = HydratedDocument<SequenceFields>;
