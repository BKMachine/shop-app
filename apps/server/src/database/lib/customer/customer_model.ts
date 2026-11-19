import { type HydratedDocument, model, Schema } from 'mongoose';

const schema = new Schema<CustomerFields>({
  name: { type: String, unique: true, required: true },
  logo: String,
  homepage: String,
  color: { type: String, default: '' },
});

export default model<CustomerFields>('customers', schema);
export type CustomerDoc = HydratedDocument<CustomerFields>;
