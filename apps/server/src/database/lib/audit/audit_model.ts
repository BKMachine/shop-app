import { model, Schema } from 'mongoose';

const schema = new Schema<AuditDoc>({
  type: String,
  timestamp: Date,
  device: { type: Schema.Types.ObjectId, ref: 'devices' },
  old: Object,
  new: Object,
});

export default model<AuditDoc>('audits', schema);
