import { model, Schema } from 'mongoose';

const schema = new Schema<SupplierFields>({
  name: { type: String, unique: true, required: true },
  logo: String,
  homepage: String,
});

export default model<SupplierFields>('suppliers', schema);
