import { Schema, model } from 'mongoose';

const schema = new Schema<VendorDoc>({
  name: { type: String, unique: true },
  logo: String,
});

export default model<VendorDoc>('vendors', schema);
