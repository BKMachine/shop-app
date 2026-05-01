import { type HydratedDocument, model, Schema } from 'mongoose';

const schema = new Schema<ShipperFields>({
  name: { type: String, unique: true, required: true },
  logo: String,
  homepage: String,
});

export default model<ShipperFields>('shippers', schema);
export type ShipperDoc = HydratedDocument<ShipperFields>;
