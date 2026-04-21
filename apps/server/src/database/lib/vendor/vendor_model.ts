import { type HydratedDocument, model, Schema } from 'mongoose';

const schema = new Schema<VendorFields>({
  name: { type: String, unique: true, required: true },
  logo: String,
  homepage: String,
  coatings: Array,
});

export default model<VendorFields>('vendors', schema);
export type VendorDoc = HydratedDocument<VendorFields>;
