import { Schema, model } from 'mongoose';

const schema = new Schema<CustomerDoc>({
  name: { type: String, unique: true, required: true },
  logo: String,
  homepage: String,
});

export default model<CustomerDoc>('customers', schema);
