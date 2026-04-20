import { model, Schema } from 'mongoose';

const schema = new Schema<CustomerFields>({
  name: { type: String, unique: true, required: true },
  logo: String,
  homepage: String,
});

export default model<CustomerFields>('customers', schema);
