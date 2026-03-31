import { model, Schema } from 'mongoose';

const deviceSchema = new Schema<DeviceDoc>(
  {
    deviceId: { type: String, required: true, unique: true, index: true },
    displayName: { type: String, required: true },
    deviceType: { type: String, enum: ['pc', 'android', 'unknown'], default: 'unknown' },
    isAdmin: { type: Boolean, default: false },
    approved: { type: Boolean, default: true },
    blocked: { type: Boolean, default: false },

    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },

    lastIp: { type: String, default: null },
    lastUserAgent: { type: String, default: null },
  },
  {
    timestamps: true,
  },
);

export default model<DeviceDoc>('devices', deviceSchema);
