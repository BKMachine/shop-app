import { model, Schema } from 'mongoose';

const schema = new Schema<EmailReportDoc>({
  email: { type: String, unique: true, required: true },
  tooling: {
    to: { type: Boolean, default: false },
    cc: { type: Boolean, default: false },
  },
});

export default model<EmailReportDoc>('reports', schema);
