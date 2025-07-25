import { model, Schema } from 'mongoose';

const schema = new Schema<SupplierDoc>({
  name: { type: String, unique: true, required: true },
  logo: String,
  homepage: String,
});

export default model<SupplierDoc>('suppliers', schema);
