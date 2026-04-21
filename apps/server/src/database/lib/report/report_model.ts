import { type HydratedDocument, model, Schema } from 'mongoose';

const schema = new Schema<EmailReportFields>({
  email: { type: String, unique: true, required: true, trim: true, lowercase: true },
  tooling: {
    to: { type: Boolean, default: false },
    cc: { type: Boolean, default: false },
  },
});

export default model<EmailReportFields>('reports', schema);
export type EmailReportDoc = HydratedDocument<EmailReportFields>;
