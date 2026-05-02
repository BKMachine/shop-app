import { type HydratedDocument, model, Schema, type Types } from 'mongoose';

type ShipmentDocumentFields = Omit<ShipmentFields, 'customer' | 'shipper' | 'imageIds'> & {
  shippedAt: Date;
  customer?: Types.ObjectId | null;
  shipper?: Types.ObjectId | null;
  imageIds?: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
};

const schema = new Schema<ShipmentDocumentFields>(
  {
    shippedAt: { type: Date, required: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: 'customers', default: null, index: true },
    shipper: { type: Schema.Types.ObjectId, ref: 'shippers', default: null, index: true },
    orderNumber: { type: String, default: '', index: true },
    trackingNumber: { type: String, default: '', index: true },
    carrier: { type: String, default: '' },
    notes: { type: String, default: '' },
    imageIds: [{ type: Schema.Types.ObjectId, ref: 'images' }],
  },
  {
    timestamps: true,
  },
);

schema.index({
  orderNumber: 'text',
  trackingNumber: 'text',
  carrier: 'text',
  notes: 'text',
});

export default model<ShipmentDocumentFields>('shipments', schema);
export type ShipmentDoc = HydratedDocument<ShipmentDocumentFields>;
