import { model, Schema } from 'mongoose';

const schema = new Schema<ReportDoc>({
  email: { type: String, unique: true, required: true },
  tooling: {
    to: { type: Boolean, default: false },
    cc: { type: Boolean, default: false },
  },
});

export default model<ReportDoc>('reports', schema);
