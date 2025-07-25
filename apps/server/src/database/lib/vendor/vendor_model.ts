import { model, Schema } from 'mongoose';

const schema = new Schema<VendorDoc>({
  name: { type: String, unique: true, required: true },
  logo: String,
  homepage: String,
  coatings: Array,
});

export default model<VendorDoc>('vendors', schema);
