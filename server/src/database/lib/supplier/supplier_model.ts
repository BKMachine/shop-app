import { Schema, model } from 'mongoose';

const schema = new Schema<SupplierDoc>({
  name: { type: String, unique: true },
  logo: String,
  homepage: String,
});

export default model<SupplierDoc>('suppliers', schema);
