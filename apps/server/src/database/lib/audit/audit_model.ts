import { model, Schema } from 'mongoose';

const schema = new Schema<AuditDoc>({
  type: {
    type: String,
    enum: [
      'tool',
      'material',
      'part',
      'shipment',
      'image',
      'document',
      'customer',
      'supplier',
      'shipper',
      'vendor',
      'report',
      'part_note',
    ],
    required: true,
  },
  timestamp: Date,
  device: { type: Schema.Types.ObjectId, ref: 'devices' },
  old: Object,
  new: Object,
});

export default model<AuditDoc>('audits', schema);
