import { type HydratedDocument, model, Schema } from 'mongoose';

const schema = new Schema<DepartmentFields>({
  name: { type: String, unique: true, required: true, trim: true },
});

export default model<DepartmentFields>('departments', schema);
export type DepartmentDoc = HydratedDocument<DepartmentFields>;
