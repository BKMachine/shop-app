import { model, Schema, type Types } from 'mongoose';

export interface MachineDoc {
  _id: Types.ObjectId;
  name: string;
  serialNumber: string;
  brand: MachineBrand;
  model: string;
  source: MachineSource;
  type: MachineType;
  paths: '1' | '2';
  location: string;
}

const schema = new Schema<MachineDoc>({
  name: String,
  serialNumber: String,
  brand: String,
  model: String,
  source: String,
  type: String,
  paths: String,
  location: { type: String, unique: true },
});

export default model<MachineDoc>('machines', schema);
